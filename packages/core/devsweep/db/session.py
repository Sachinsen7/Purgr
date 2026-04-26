from __future__ import annotations

import json
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


async def _apply_compat_migrations(connection) -> None:
    table_info = await connection.exec_driver_sql("PRAGMA table_info('scansession')")
    columns = [row[1] for row in table_info.fetchall()]
    if not columns:
        return

    if "root_paths" not in columns:
        await connection.exec_driver_sql(
            "ALTER TABLE scansession ADD COLUMN root_paths TEXT"
        )
        if "root_path" in columns:
            rows = await connection.exec_driver_sql(
                "SELECT id, root_path FROM scansession"
            )
            for row_id, root_path in rows.fetchall():
                payload = json.dumps([root_path]) if root_path else json.dumps([])
                await connection.exec_driver_sql(
                    "UPDATE scansession SET root_paths = ? WHERE id = ?",
                    (payload, row_id),
                )
        else:
            await connection.exec_driver_sql(
                "UPDATE scansession SET root_paths = '[]' WHERE root_paths IS NULL"
            )


async def create_db_and_tables() -> None:
    """Create database tables if they do not already exist."""
    async with engine.begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
        await _apply_compat_migrations(connection)
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
