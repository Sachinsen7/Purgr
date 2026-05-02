from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


class ScanSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    root_path: str = ""
    root_paths: str = "[]"
    total_files_scanned: int = 0
    total_size_scanned: int = 0
    total_size_found: int = 0
    total_size_cleaned: int = 0
    scan_duration_seconds: float = 0.0

    results: List["ScanResult"] = Relationship(back_populates="session")
    issues: List["ScanIssue"] = Relationship(back_populates="session")
    index_entries: List["FileIndexEntry"] = Relationship(
        back_populates="session"
    )


class ScanResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scansession.id")
    file_path: str
    file_size: int
    file_mtime: float
    is_directory: bool
    total_score: int
    classification: str
    tool: str = "filesystem"
    reason: str = ""
    ai_explanation: str = ""
    cleanup_preset: str = "deep"
    recovery_hint: str = ""
    last_git_commit_at: Optional[datetime] = None
    package_fingerprint: str = ""
    age_score: int
    age_reason: str
    version_score: int
    version_reason: str
    process_score: int
    process_reason: str
    project_score: int
    project_reason: str
    rule_matches: str = ""
    marked_for_deletion: bool = False
    deletion_reason: Optional[str] = None

    session: ScanSession = Relationship(back_populates="results")
    audit_logs: List["DeletionAudit"] = Relationship(back_populates="result")


class ScanIssue(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scansession.id")
    path: str
    kind: str
    message: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    session: ScanSession = Relationship(back_populates="issues")


class FileIndexEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="scansession.id")
    file_path: str
    file_size: int
    file_mtime: float
    snippet: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

    session: ScanSession = Relationship(back_populates="index_entries")


class DeletionAudit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    result_id: int = Field(foreign_key="scanresult.id")
    action: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    reason: Optional[str] = None
    file_existed: bool
    file_size_at_action: Optional[int] = None

    result: ScanResult = Relationship(back_populates="audit_logs")


class LearnedPattern(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pattern: str
    action: str
    confidence: float
    reason: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used: datetime = Field(default_factory=datetime.utcnow)
    use_count: int = 0
    success_rate: float = 0.0

    applications: List["PatternApplication"] = Relationship(
        back_populates="pattern"
    )


class PatternApplication(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pattern_id: int = Field(foreign_key="learnedpattern.id")
    result_id: int = Field(foreign_key="scanresult.id")
    applied_at: datetime = Field(default_factory=datetime.utcnow)
    user_agreed: Optional[bool] = None
    actual_action: str

    pattern: LearnedPattern = Relationship(back_populates="applications")
