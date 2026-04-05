from pathlib import Path
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from ..config.settings import get_settings


def get_database_url() -> str:
    """Get the database URL from settings or use default SQLite path."""
    settings = get_settings()
    
    # Use user data directory for database
    if hasattr(settings, 'database_path'):
        db_path = Path(settings.database_path)
    else:
        # Default to user data directory
        import os
        if os.name == 'nt':  # Windows
            data_dir = Path(os.environ.get('APPDATA', '~/AppData/Roaming')) / 'DevSweep'
        else:  # Unix-like
            data_dir = Path.home() / '.local' / 'share' / 'devsweep'
        
        data_dir.mkdir(parents=True, exist_ok=True)
        db_path = data_dir / 'devsweep.db'
    
    return f"sqlite+aiosqlite:///{db_path}"


# Create async engine
engine = create_async_engine(
    get_database_url(),
    echo=False,  # Set to True for SQL logging during development
    future=True,
)


# Create async session factory
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def create_db_and_tables():
    """Create database tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for FastAPI to get async database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
