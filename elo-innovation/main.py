import hashlib
import random
import string
import uuid
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session as DBSession, select

from database import create_db, get_db
from models import Session, Rater, Comparison
from elo_engine import (
    recalculate_ratings,
    get_next_pair,
    completion_stats,
    aggregate_rankings,
)

app = FastAPI(title="Innovation ELO Rating API", version="1.0.0")

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


# ── Request / Response Schemas ────────────────────────────────────────────────

class InnovationItem(BaseModel):
    id: str
    title: str
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


class NextPairResponse(BaseModel):
    innovation_a: dict
    innovation_b: dict
    progress: dict


class RankingItem(BaseModel):
    rank: int
    id: str
    title: str
    description: str
    rating: float


# ── Admin: Session Management ─────────────────────────────────────────────────

@app.post("/sessions", response_model=CreateSessionResponse, tags=["Admin"])
def create_session(req: CreateSessionRequest, db: DBSession = Depends(get_db)):
    """Create a new session with innovations. Returns a 6-digit room code."""
    if len(req.innovations) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 innovations")

    # Generate unique room code
    for _ in range(10):
        code = generate_room_code()
        existing = db.exec(select(Session).where(Session.room_code == code)).first()
        if not existing:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique room code")

    import json
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
def get_session_info(room_code: str, admin_password: str, db: DBSession = Depends(get_db)):
    """Get session details + all raters + completion stats. Requires admin password."""
    session = get_session_or_404(room_code, db)
    if session.admin_password != hash_password(admin_password):
        raise HTTPException(status_code=403, detail="Wrong admin password")

    raters = db.exec(select(Rater).where(Rater.session_id == session.id)).all()
    innovations = session.get_innovations()

    rater_stats = []
    for rater in raters:
        comps = db.exec(
            select(Comparison)
            .where(Comparison.rater_id == rater.id)
        ).all()
        stats = completion_stats(innovations, comps)
        rater_stats.append({
            "id": rater.id,
            "name": rater.name,
            "joined_at": rater.joined_at,
            **stats,
        })

    return {
        "room_code": session.room_code,
        "title": session.title,
        "innovation_count": len(innovations),
        "innovations": innovations,
        "created_at": session.created_at,
        "is_active": session.is_active,
        "raters": rater_stats,
    }


@app.get("/sessions/{room_code}/rankings", tags=["Admin"])
def get_aggregate_rankings(room_code: str, admin_password: str, db: DBSession = Depends(get_db)):
    """Get aggregate rankings across all raters. Requires admin password."""
    session = get_session_or_404(room_code, db)
    if session.admin_password != hash_password(admin_password):
        raise HTTPException(status_code=403, detail="Wrong admin password")

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

    aggregate = aggregate_rankings(innovations, all_ratings)

    return {
        "session_title": session.title,
        "total_raters": len(raters),
        "raters_with_votes": len(all_ratings),
        "aggregate_rankings": aggregate,
        "individual_rankings": rater_breakdowns,
    }


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

    # Check if name already taken in this session
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

    comparisons = db.exec(
        select(Comparison).where(Comparison.rater_id == rater.id)
    ).all()

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

    # Prevent duplicate votes for the same pair
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
