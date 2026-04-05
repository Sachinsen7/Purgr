from datetime import datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class ScanSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    root_path: str
    total_files_scanned: int = 0
    total_size_scanned: int = 0
    scan_duration_seconds: float = 0.0

    # Relationships
    results: list["ScanResult"] = Relationship(back_populates="session")


class ScanResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scansession.id")

    # File information
    file_path: str
    file_size: int
    file_mtime: float
    is_directory: bool

    # Scoring results
    total_score: int
    classification: str

    # Signal results stored as JSON
    age_score: int
    age_reason: str
    version_score: int
    version_reason: str
    process_score: int
    process_reason: str
    project_score: int
    project_reason: str

    # Rule matches stored as JSON
    rule_matches: str = ""  # JSON string of matched rules

    # Deletion tracking
    marked_for_deletion: bool = False
    deletion_reason: Optional[str] = None

    # Relationships
    session: ScanSession = Relationship(back_populates="results")
    audit_logs: list["DeletionAudit"] = Relationship(back_populates="result")


class DeletionAudit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    result_id: int = Field(foreign_key="scanresult.id")

    action: str  # "marked", "unmarked", "deleted", "restored"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    reason: Optional[str] = None

    # File state at time of action
    file_existed: bool
    file_size_at_action: Optional[int] = None

    # Relationships
    result: ScanResult = Relationship(back_populates="audit_logs")


class LearnedPattern(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pattern: str  # Regex pattern
    action: str  # "keep", "delete", "review"
    confidence: float  # 0-1
    reason: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used: datetime = Field(default_factory=datetime.utcnow)
    use_count: int = 0
    success_rate: float = 0.0  # How often user agreed with recommendation

    # Relationships
    applications: list["PatternApplication"] = Relationship(back_populates="pattern")


class PatternApplication(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pattern_id: int = Field(foreign_key="learnedpattern.id")
    result_id: int = Field(foreign_key="scanresult.id")

    applied_at: datetime = Field(default_factory=datetime.utcnow)
    user_agreed: Optional[bool] = None  # None=unknown, True=agreed, False=disagreed
    actual_action: str  # What user actually did

    # Relationships
    pattern: LearnedPattern = Relationship(back_populates="applications")
