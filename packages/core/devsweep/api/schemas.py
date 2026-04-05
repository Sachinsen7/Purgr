from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ScanRequest(BaseModel):
    rootPath: str
    includeHidden: bool = False
    maxDepth: int | None = Field(default=None, ge=1)


class ScanResultResponse(BaseModel):
    id: str
    path: str
    size: int
    score: int
    classification: Literal["safe", "optional", "critical"]
    recommendation: Literal["keep", "delete", "review"]
    confidence: float


class ScanSessionResponse(BaseModel):
    id: str
    rootPath: str
    status: Literal["idle", "scanning", "completed", "error"]
    progress: float
    totalFiles: int
    scannedFiles: int
    results: list[ScanResultResponse] = Field(default_factory=list)
    startTime: datetime | None = None
    endTime: datetime | None = None
    error: str | None = None


class AIAdviceResponse(BaseModel):
    recommendation: Literal["keep", "delete", "review"]
    confidence: float
    explanation: str
    reasoningSignals: list[str]
    similarPatterns: list[str]


class AIAdviceRequest(BaseModel):
    filePath: str


class LearnActionRequest(BaseModel):
    filePath: str
    action: Literal["keep", "delete", "review"]
    reason: str = ""


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
    ai: AISettings = Field(default_factory=AISettings)
    scanning: ScanningSettings = Field(default_factory=ScanningSettings)
    exclusions: list[str] = Field(default_factory=list)
