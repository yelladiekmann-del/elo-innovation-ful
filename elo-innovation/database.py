import os
from sqlmodel import SQLModel, create_engine, Session as DBSession

_raw = os.environ.get("DATABASE_URL", "sqlite:///./elo_innovation.db")

# Railway (and older Heroku) provision Postgres URLs with "postgres://" but
# SQLAlchemy 1.4+ requires "postgresql://".
DATABASE_URL = _raw.replace("postgres://", "postgresql://", 1)

_is_sqlite = DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
else:
    # pool_pre_ping=True drops stale connections before use — critical for Railway
    # which can reset idle Postgres connections.
    engine = create_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        echo=False,
    )


def create_db():
    SQLModel.metadata.create_all(engine)


def get_db():
    with DBSession(engine) as session:
        yield session
