from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, JSON, Column
import json


class Session(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    room_code: str = Field(unique=True, index=True)  # e.g. "847291"
    admin_password: str  # hashed
    innovations_json: str  # JSON list of {id, title, description}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)

    def get_innovations(self) -> list[dict]:
        return json.loads(self.innovations_json)


class Rater(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="session.id", index=True)
    name: str
    token: str = Field(unique=True, index=True)  # UUID, stored in browser localStorage
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class Comparison(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="session.id", index=True)
    rater_id: int = Field(foreign_key="rater.id", index=True)
    winner_id: str  # innovation id
    loser_id: str   # innovation id
    created_at: datetime = Field(default_factory=datetime.utcnow)
