from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from ..config.settings import get_settings


def get_database_url() -> str:
    """Return the configured async database URL."""
    settings = get_settings()
    db_path = Path(settings.database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite+aiosqlite:///{db_path}"


engine = create_async_engine(
    get_database_url(),
    echo=False,
    future=True,
)

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def create_db_and_tables() -> None:
    """Create database tables if they do not already exist."""
    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Return an async database session as a context manager."""
    async with AsyncSessionFactory() as session:
        yield session


async def session_dependency() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency wrapper around the session context manager."""
    async with get_session() as session:
        yield session
