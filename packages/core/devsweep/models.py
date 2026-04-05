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


class FileRule(BaseModel):
    pattern: str
    description: str
    score_adjustment: int = 0  # Bonus/penalty to total score
    classification_override: str | None = None  # Force classification


class ToolRules(BaseModel):
    tool: str
    rules: list[FileRule]


class AIAdvice(BaseModel):
    recommendation: str  # 'keep', 'delete', 'review'
    confidence: float  # 0-1
    explanation: str
    reasoning_signals: list[str]  # Key factors considered
    similar_patterns: list[str]  # Similar past decisions
