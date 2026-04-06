# Innovation ELO Rating System

A backend API for pairwise Elo-based prioritisation of innovation opportunities across multiple raters.

## How it works

1. **Admin** creates a session → gets a **6-digit room code**
2. **Raters** go to your deployed URL, enter the code + their name → start comparing
3. Each comparison is a simple **"which is more worth exploring?"** choice
4. Behind the scenes, [elote](https://github.com/wdm0006/elote)'s `EloCompetitor` updates ratings
5. Admin views aggregate rankings across all raters

---

## Quick Start (local)

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://localhost:8000/docs for the interactive API explorer.

---

## Deploy to Railway (shareable public URL)

1. Push this folder to a GitHub repo
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo → Railway auto-detects Python
4. Done — you get a URL like `https://yourapp.up.railway.app`

> **Persistent storage note:** Railway's filesystem is ephemeral. For production use, swap SQLite for a Railway PostgreSQL addon (one click) and update `DATABASE_URL` in the environment variables.

---

## API Overview

### Admin endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions` | Create session + upload innovations |
| GET | `/sessions/{room_code}?admin_password=` | Session info + rater progress |
| GET | `/sessions/{room_code}/rankings?admin_password=` | Aggregate + individual rankings |

### Rater endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/join/{room_code}` | Validate room code |
| POST | `/join/{room_code}` | Join with name → get token |
| GET | `/vote/{token}/next` | Get next pair to compare |
| POST | `/vote` | Submit a comparison result |
| GET | `/vote/{token}/rankings` | View personal rankings |

---

## Creating a Session (example payload)

```json
POST /sessions
{
  "title": "Q3 Innovation Sprint",
  "admin_password": "your-secret",
  "innovations": [
    { "id": "inn-01", "title": "AI-powered onboarding", "description": "..." },
    { "id": "inn-02", "title": "Predictive churn scoring", "description": "..." },
    ...
  ]
}
```

Returns:
```json
{ "room_code": "847291", "title": "Q3 Innovation Sprint", "innovation_count": 27 }
```

Share `room_code` with your team. Each rater needs ~50–80 comparisons for 25–30 innovations.

---

## How pair selection works

1. **Coverage first** — uncovered pairs are shown before repeats
2. **Closest-rated pairs** — among uncovered pairs, the one with most similar current Elo ratings is chosen (most informative for convergence)
3. **Stateless ratings** — ratings are always recalculated by replaying the full comparison history, so the log is the source of truth

---

## Data model

```
Session      → room_code, title, innovations (JSON), admin_password (hashed)
Rater        → session_id, name, token (UUID stored in browser)
Comparison   → rater_id, winner_id, loser_id, timestamp
```

Ratings are **derived** from comparisons — never stored directly. Clean, auditable, replayable.
