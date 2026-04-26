from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ThemeMode = Literal["light", "dark"]
ScanStatus = Literal["idle", "scanning", "completed", "error"]
ScanPhase = Literal["preparing", "scanning", "finalizing", "completed", "error"]
Classification = Literal["safe", "optional", "critical"]
Recommendation = Literal["keep", "delete", "review"]
CleanupMode = Literal["recycle", "permanent"]


class ScanRequest(BaseModel):
    selectedDrives: list[str] | None = None
    includeHidden: bool | None = None
    maxDepth: int | None = Field(default=None, ge=1)


class ScanResultResponse(BaseModel):
    id: str
    path: str
    size: int
    score: int
    classification: Classification
    recommendation: Recommendation
    confidence: float
    modifiedAt: datetime
    bucket: str
    drive: str
    isHidden: bool
    extension: str | None = None


class BucketSummaryResponse(BaseModel):
    bucket: str
    label: str
    fileCount: int
    totalSize: int


class DriveSummaryResponse(BaseModel):
    drive: str
    label: str
    fileCount: int
    totalSize: int
    hiddenCount: int
    issueCount: int


class ScanIssueResponse(BaseModel):
    path: str
    kind: Literal["unreadable", "protected", "error"]
    message: str


class ScanSummaryResponse(BaseModel):
    totalFiles: int = 0
    totalSize: int = 0
    hiddenFiles: int = 0
    issueCount: int = 0
    deletableFiles: int = 0
    deletableSize: int = 0
    reviewFiles: int = 0


class ScanSessionResponse(BaseModel):
    id: str
    rootPaths: list[str]
    status: ScanStatus
    phase: ScanPhase
    progress: float
    discoveredFiles: int
    processedFiles: int
    bytesScanned: int
    etaSeconds: int | None = None
    currentDrive: str | None = None
    currentPath: str | None = None
    startTime: datetime | None = None
    endTime: datetime | None = None
    error: str | None = None
    summary: ScanSummaryResponse = Field(default_factory=ScanSummaryResponse)
    driveSummaries: list[DriveSummaryResponse] = Field(default_factory=list)
    bucketSummaries: list[BucketSummaryResponse] = Field(default_factory=list)
    topFiles: list[ScanResultResponse] = Field(default_factory=list)
    oldestFile: ScanResultResponse | None = None
    newestFile: ScanResultResponse | None = None
    recentFindings: list[ScanResultResponse] = Field(default_factory=list)
    issues: list[ScanIssueResponse] = Field(default_factory=list)


class ScanDetailsResponse(BaseModel):
    session: ScanSessionResponse
    results: list[ScanResultResponse] = Field(default_factory=list)


class DriveInfoResponse(BaseModel):
    id: str
    path: str
    label: str
    fileSystem: str
    totalBytes: int
    freeBytes: int
    usedBytes: int


class ManagedTargetResponse(BaseModel):
    tool: str
    label: str
    path: str
    exists: bool


class SystemOverviewResponse(BaseModel):
    drives: list[DriveInfoResponse] = Field(default_factory=list)
    managedTargets: list[ManagedTargetResponse] = Field(default_factory=list)
    historyCount: int = 0
    activeScanId: str | None = None
    lastCompletedScanId: str | None = None


class AssistantQueryRequest(BaseModel):
    query: str = Field(min_length=1)
    sessionId: str | None = None
    limit: int = Field(default=8, ge=1, le=25)


class AssistantMatchResponse(BaseModel):
    path: str
    snippet: str
    size: int
    modifiedAt: datetime


class AssistantQueryResponse(BaseModel):
    query: str
    answer: str
    matches: list[AssistantMatchResponse] = Field(default_factory=list)


class DeleteFilesRequest(BaseModel):
    filePaths: list[str] = Field(default_factory=list)
    mode: CleanupMode = "recycle"


class DeleteFilesResponse(BaseModel):
    deleted: int
    mode: CleanupMode


class AIAdviceResponse(BaseModel):
    recommendation: Recommendation
    confidence: float
    explanation: str
    reasoningSignals: list[str]
    similarPatterns: list[str]


class AIAdviceRequest(BaseModel):
    filePath: str


class LearnActionRequest(BaseModel):
    filePath: str
    action: Recommendation
    reason: str = ""


class AppearanceSettings(BaseModel):
    theme: ThemeMode = "dark"


class AISettings(BaseModel):
    enabled: bool = True
    provider: Literal["ollama"] = "ollama"
    model: str = "llama3.2"
    baseUrl: str = "http://localhost:11434"


class ToolsetSettings(BaseModel):
    vscode: bool = True
    android: bool = True
    node: bool = True
    python: bool = False


class ScanningSettings(BaseModel):
    frequency: Literal["manual", "weekly", "monthly"] = "manual"
    includeHidden: bool = True
    followSymlinks: bool = False
    maxDepth: int | None = Field(default=None, ge=1)
    toolsets: ToolsetSettings = Field(default_factory=ToolsetSettings)


class AppSettings(BaseModel):
    appearance: AppearanceSettings = Field(default_factory=AppearanceSettings)
    ai: AISettings = Field(default_factory=AISettings)
    scanning: ScanningSettings = Field(default_factory=ScanningSettings)
    exclusions: list[str] = Field(default_factory=list)
