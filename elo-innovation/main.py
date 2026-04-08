import csv
import hashlib
import io
import json
import os
import random
import string
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlmodel import Session as DBSession, select

from database import create_db, get_db
from models import Comparison, Rater, Session
from elo_engine import (
    aggregate_rankings,
    completion_stats,
    get_next_pair,
    recalculate_ratings,
)

app = FastAPI(title="Innovation ELO Rating API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db()


# ── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def generate_room_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def get_session_or_404(room_code: str, db: DBSession) -> Session:
    session = db.exec(select(Session).where(Session.room_code == room_code)).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def get_rater_or_404(token: str, db: DBSession) -> Rater:
    rater = db.exec(select(Rater).where(Rater.token == token)).first()
    if not rater:
        raise HTTPException(status_code=404, detail="Rater not found. Check your token.")
    return rater


# ── JWT Auth ──────────────────────────────────────────────────────────────────

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
_bearer = HTTPBearer(auto_error=False)


def create_admin_token(room_code: str) -> str:
    payload = {
        "sub": room_code,
        "exp": datetime.utcnow() + timedelta(hours=8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_admin_token(
    room_code: str,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> None:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authorization header required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if payload.get("sub") != room_code:
        raise HTTPException(status_code=403, detail="Token is for a different session")


# ── Request / Response Schemas ────────────────────────────────────────────────

class InnovationItem(BaseModel):
    id: str
    title: str
    problem: str = ""
    description: str = ""


class CreateSessionRequest(BaseModel):
    title: str
    admin_password: str
    innovations: list[InnovationItem]


class CreateSessionResponse(BaseModel):
    room_code: str
    title: str
    innovation_count: int
    message: str


class AdminLoginRequest(BaseModel):
    room_code: str
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    room_code: str
    title: str


class PatchSessionRequest(BaseModel):
    is_active: bool


class JoinSessionRequest(BaseModel):
    name: str


class JoinSessionResponse(BaseModel):
    token: str
    rater_name: str
    room_code: str
    message: str


class VoteRequest(BaseModel):
    token: str
    winner_id: str
    loser_id: str


# ── Admin: Auth ───────────────────────────────────────────────────────────────

@app.post("/admin/login", response_model=AdminLoginResponse, tags=["Admin"])
def admin_login(req: AdminLoginRequest, db: DBSession = Depends(get_db)):
    """Validate admin password and return a JWT scoped to this session."""
    session = get_session_or_404(req.room_code, db)
    if session.admin_password != hash_password(req.password):
        raise HTTPException(status_code=403, detail="Wrong admin password")
    token = create_admin_token(req.room_code)
    return AdminLoginResponse(token=token, room_code=req.room_code, title=session.title)


# ── Admin: Session Management ─────────────────────────────────────────────────

@app.post("/sessions", response_model=CreateSessionResponse, tags=["Admin"])
def create_session(req: CreateSessionRequest, db: DBSession = Depends(get_db)):
    """Create a new session with innovations. Returns a 6-digit room code."""
    if len(req.innovations) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 innovations")

    for _ in range(10):
        code = generate_room_code()
        existing = db.exec(select(Session).where(Session.room_code == code)).first()
        if not existing:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique room code")

    session = Session(
        title=req.title,
        room_code=code,
        admin_password=hash_password(req.admin_password),
        innovations_json=json.dumps([i.dict() for i in req.innovations]),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return CreateSessionResponse(
        room_code=code,
        title=session.title,
        innovation_count=len(req.innovations),
        message=f"Session created. Share room code: {code}",
    )


@app.get("/sessions", tags=["Admin"])
def list_sessions(db: DBSession = Depends(get_db)):
    """List all sessions — room codes, titles, creation dates."""
    sessions = db.exec(select(Session).order_by(Session.created_at.desc())).all()
    return [
        {
            "room_code": s.room_code,
            "title": s.title,
            "innovation_count": len(s.get_innovations()),
            "created_at": s.created_at,
            "is_active": s.is_active,
        }
        for s in sessions
    ]


@app.get("/sessions/{room_code}", tags=["Admin"])
def get_session_info(
    room_code: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    db: DBSession = Depends(get_db),
):
    """Get session details + all raters + completion stats. Requires admin JWT."""
    verify_admin_token(room_code, credentials)
    session = get_session_or_404(room_code, db)

    raters = db.exec(select(Rater).where(Rater.session_id == session.id)).all()
    innovations = session.get_innovations()

    rater_stats = []
    for rater in raters:
        comps = db.exec(select(Comparison).where(Comparison.rater_id == rater.id)).all()
        stats = completion_stats(innovations, comps)
        rater_stats.append({"id": rater.id, "name": rater.name, "joined_at": rater.joined_at, **stats})

    return {
        "room_code": session.room_code,
        "title": session.title,
        "innovation_count": len(innovations),
        "innovations": innovations,
        "created_at": session.created_at,
        "is_active": session.is_active,
        "raters": rater_stats,
    }


@app.patch("/sessions/{room_code}", tags=["Admin"])
def patch_session(
    room_code: str,
    req: PatchSessionRequest,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    db: DBSession = Depends(get_db),
):
    """Toggle a session's active state. Requires admin JWT."""
    verify_admin_token(room_code, credentials)
    session = get_session_or_404(room_code, db)
    session.is_active = req.is_active
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"room_code": session.room_code, "is_active": session.is_active}


@app.delete("/sessions/{room_code}", tags=["Admin"])
def delete_session(
    room_code: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    db: DBSession = Depends(get_db),
):
    """Delete a session and all its data. Requires admin JWT."""
    verify_admin_token(room_code, credentials)
    session = get_session_or_404(room_code, db)

    # Delete children in FK-safe order: Comparisons → Raters → Session
    raters = db.exec(select(Rater).where(Rater.session_id == session.id)).all()
    for rater in raters:
        comparisons = db.exec(select(Comparison).where(Comparison.rater_id == rater.id)).all()
        for comp in comparisons:
            db.delete(comp)
        db.delete(rater)
    db.delete(session)
    db.commit()
    return {"deleted": room_code}


@app.get("/sessions/{room_code}/rankings", tags=["Admin"])
def get_aggregate_rankings(
    room_code: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    db: DBSession = Depends(get_db),
):
    """Get aggregate rankings across all raters. Requires admin JWT."""
    verify_admin_token(room_code, credentials)
    session = get_session_or_404(room_code, db)

    innovations = session.get_innovations()
    raters = db.exec(select(Rater).where(Rater.session_id == session.id)).all()

    all_ratings = []
    rater_breakdowns = []
    for rater in raters:
        comps = db.exec(select(Comparison).where(Comparison.rater_id == rater.id)).all()
        if comps:
            ratings = recalculate_ratings(innovations, comps)
            all_ratings.append(ratings)
            ranked = sorted(innovations, key=lambda i: ratings.get(i["id"], 1000), reverse=True)
            rater_breakdowns.append({
                "rater_name": rater.name,
                "rankings": [
                    {"rank": idx + 1, "id": i["id"], "title": i["title"], "rating": round(ratings.get(i["id"], 1000), 1)}
                    for idx, i in enumerate(ranked)
                ],
            })

    agg = aggregate_rankings(innovations, all_ratings)

    return {
        "session_title": session.title,
        "total_raters": len(raters),
        "raters_with_votes": len(all_ratings),
        "aggregate_rankings": agg,
        "individual_rankings": rater_breakdowns,
    }


@app.get("/sessions/{room_code}/export", tags=["Admin"])
def export_session_csv(
    room_code: str,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    db: DBSession = Depends(get_db),
):
    """Export rankings as a CSV file. Requires admin JWT."""
    verify_admin_token(room_code, credentials)
    session = get_session_or_404(room_code, db)

    innovations = session.get_innovations()
    raters = db.exec(select(Rater).where(Rater.session_id == session.id)).all()

    # Build per-rater ratings maps
    rater_ratings: dict[str, dict[str, float]] = {}
    all_ratings = []
    for rater in raters:
        comps = db.exec(select(Comparison).where(Comparison.rater_id == rater.id)).all()
        if comps:
            r = recalculate_ratings(innovations, comps)
            rater_ratings[rater.name] = r
            all_ratings.append(r)
        else:
            rater_ratings[rater.name] = {}

    agg = aggregate_rankings(innovations, all_ratings)
    rater_names = [r.name for r in raters]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["rank", "id", "title", "description", "mean_rating", "std_dev", "num_raters"] + rater_names)

    for item in agg:
        row = [
            item["rank"],
            item["id"],
            item["title"],
            item.get("description", ""),
            item["mean_rating"],
            item["std_dev"],
            item["num_raters"],
        ]
        for name in rater_names:
            personal = rater_ratings.get(name, {})
            row.append(round(personal.get(item["id"], 1000), 1) if personal else "")
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="rankings_{room_code}.csv"'},
    )


# ── Rater: Join & Vote ────────────────────────────────────────────────────────

@app.get("/join/{room_code}", tags=["Rater"])
def check_room(room_code: str, db: DBSession = Depends(get_db)):
    """Check if a room code is valid before joining."""
    session = get_session_or_404(room_code, db)
    if not session.is_active:
        raise HTTPException(status_code=400, detail="This session is no longer active")
    return {
        "valid": True,
        "title": session.title,
        "innovation_count": len(session.get_innovations()),
    }


@app.post("/join/{room_code}", response_model=JoinSessionResponse, tags=["Rater"])
def join_session(room_code: str, req: JoinSessionRequest, db: DBSession = Depends(get_db)):
    """Join a session by name. Returns a token to store in localStorage."""
    session = get_session_or_404(room_code, db)
    if not session.is_active:
        raise HTTPException(status_code=400, detail="This session is no longer active")

    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    existing = db.exec(
        select(Rater).where(Rater.session_id == session.id, Rater.name == name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Name '{name}' is already taken in this session. Please choose a different name.",
        )

    token = str(uuid.uuid4())
    rater = Rater(session_id=session.id, name=name, token=token)
    db.add(rater)
    db.commit()

    return JoinSessionResponse(
        token=token,
        rater_name=name,
        room_code=room_code,
        message=f"Welcome {name}! Store your token to resume later.",
    )


@app.get("/vote/{token}/next", tags=["Rater"])
def get_next_comparison(token: str, db: DBSession = Depends(get_db)):
    """Get the next pair to compare for a rater."""
    rater = get_rater_or_404(token, db)
    session = db.get(Session, rater.session_id)
    innovations = session.get_innovations()

    comparisons = db.exec(select(Comparison).where(Comparison.rater_id == rater.id)).all()
    ratings = recalculate_ratings(innovations, comparisons)
    pair = get_next_pair(innovations, comparisons, ratings)
    progress = completion_stats(innovations, comparisons)

    if pair is None:
        return {
            "complete": True,
            "progress": progress,
            "rankings": sorted(
                [{"id": i["id"], "title": i["title"], "rating": round(ratings.get(i["id"], 1000), 1)} for i in innovations],
                key=lambda x: x["rating"],
                reverse=True,
            ),
        }

    return {
        "complete": False,
        "innovation_a": pair[0],
        "innovation_b": pair[1],
        "progress": progress,
    }


@app.post("/vote", tags=["Rater"])
def submit_vote(req: VoteRequest, db: DBSession = Depends(get_db)):
    """Submit a comparison result."""
    rater = get_rater_or_404(req.token, db)
    session = db.get(Session, rater.session_id)
    innovations = session.get_innovations()
    inn_ids = {i["id"] for i in innovations}

    if req.winner_id not in inn_ids or req.loser_id not in inn_ids:
        raise HTTPException(status_code=400, detail="Invalid innovation IDs")
    if req.winner_id == req.loser_id:
        raise HTTPException(status_code=400, detail="Winner and loser must be different")

    existing = db.exec(
        select(Comparison).where(
            Comparison.rater_id == rater.id,
            Comparison.winner_id == req.winner_id,
            Comparison.loser_id == req.loser_id,
        )
    ).first()
    existing_reverse = db.exec(
        select(Comparison).where(
            Comparison.rater_id == rater.id,
            Comparison.winner_id == req.loser_id,
            Comparison.loser_id == req.winner_id,
        )
    ).first()
    if existing or existing_reverse:
        raise HTTPException(status_code=409, detail="This pair has already been compared")

    comp = Comparison(
        session_id=rater.session_id,
        rater_id=rater.id,
        winner_id=req.winner_id,
        loser_id=req.loser_id,
    )
    db.add(comp)
    db.commit()

    comparisons = db.exec(select(Comparison).where(Comparison.rater_id == rater.id)).all()
    progress = completion_stats(innovations, comparisons)

    return {"success": True, "progress": progress}


@app.get("/vote/{token}/rankings", tags=["Rater"])
def get_my_rankings(token: str, db: DBSession = Depends(get_db)):
    """Get current personal rankings for a rater."""
    rater = get_rater_or_404(token, db)
    session = db.get(Session, rater.session_id)
    innovations = session.get_innovations()

    comparisons = db.exec(select(Comparison).where(Comparison.rater_id == rater.id)).all()
    ratings = recalculate_ratings(innovations, comparisons)
    progress = completion_stats(innovations, comparisons)

    ranked = sorted(innovations, key=lambda i: ratings.get(i["id"], 1000), reverse=True)
    return {
        "rater_name": rater.name,
        "session_title": session.title,
        "progress": progress,
        "rankings": [
            {
                "rank": idx + 1,
                "id": i["id"],
                "title": i["title"],
                "description": i.get("description", ""),
                "rating": round(ratings.get(i["id"], 1000), 1),
            }
            for idx, i in enumerate(ranked)
        ],
    }
