from pathlib import Path
from pydantic import BaseModel


class ScanEntry(BaseModel):
    path: Path
    size: int
    mtime: float
    is_dir: bool
    is_file: bool
    is_symlink: bool


class SignalResult(BaseModel):
    score: int
    reason: str


class ScoredItem(BaseModel):
    entry: ScanEntry
    total_score: int
    classification: str  # 'safe', 'optional', 'critical'
    signals: dict[str, SignalResult]
