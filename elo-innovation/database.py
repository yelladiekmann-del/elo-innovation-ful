from sqlmodel import SQLModel, create_engine, Session as DBSession

DATABASE_URL = "sqlite:///./elo_innovation.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


def create_db():
    SQLModel.metadata.create_all(engine)


def get_db():
    with DBSession(engine) as session:
        yield session
