from __future__ import annotations

import asyncio
import json
import os
import platform
import stat
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

import psutil
from sqlalchemy import delete, desc, select

from ..ai.advisor import AIAdvisor
from ..config.settings import get_settings
from ..db.models import DeletionAudit, FileIndexEntry, ScanIssue, ScanResult, ScanSession
from ..db.session import create_db_and_tables, get_session
from ..models import ScanEntry, ScoredItem
from ..rules.loader import get_matching_rules, load_rules
from ..scanner.platforms import ToolName, get_tool_paths
from ..scanner.walker import walk_directory
from ..scorer.engine import score_item
from .schemas import (
    AIAdviceResponse,
    AppSettings,
    AssistantMatchResponse,
    AssistantQueryResponse,
    BucketSummaryResponse,
    DriveInfoResponse,
    DriveSummaryResponse,
    ManagedTargetResponse,
    ScanDetailsResponse,
    ScanIssueResponse,
    ScanRequest,
    ScanResultResponse,
    ScanSessionResponse,
    ScanSummaryResponse,
    SystemOverviewResponse,
)

LIVE_FINDINGS_LIMIT = 10
TOP_FILES_LIMIT = 8
ISSUE_PREVIEW_LIMIT = 20
DB_BATCH_SIZE = 100
TEXT_INDEX_LIMIT_BYTES = 1024 * 1024
TEXT_SNIPPET_LIMIT = 1200

BUCKET_LABELS: dict[str, str] = {
    "windows": "Windows",
    "system": "System",
    "user": "User",
    "downloads": "Downloads",
    "recycle-bin": "Recycle Bin",
    "hidden": "Hidden",
    "tool:vscode": "VS Code",
    "tool:android": "Android SDK",
    "tool:node": "Node.js",
    "tool:python": "Python",
    "other": "Other",
}

TEXT_EXTENSIONS = {
    ".bat",
    ".c",
    ".cfg",
    ".cpp",
    ".cs",
    ".css",
    ".csv",
    ".env",
    ".go",
    ".html",
    ".ini",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".kt",
    ".log",
    ".md",
    ".mjs",
    ".py",
    ".rb",
    ".rs",
    ".sh",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _derive_recommendation(
    classification: Literal["safe", "optional", "critical"],
) -> Literal["keep", "delete", "review"]:
    if classification == "critical":
        return "delete"
    if classification == "optional":
        return "review"
    return "keep"


def _derive_confidence(score: int) -> float:
    return round(min(max(score / 100, 0.15), 0.98), 2)


def _apply_threshold(score: int) -> Literal["safe", "optional", "critical"]:
    if score <= 20:
        return "safe"
    if score <= 70:
        return "optional"
    return "critical"


def _normalize_path(value: str | Path) -> str:
    return str(value).replace("/", "\\").rstrip("\\").lower()


def _is_under_path(path: Path, candidate: Path) -> bool:
    path_text = _normalize_path(path)
    candidate_text = _normalize_path(candidate)
    return path_text == candidate_text or path_text.startswith(f"{candidate_text}\\")


def _deserialize_root_paths(payload: str | None, fallback: str | None = None) -> list[str]:
    if payload:
        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, list):
            normalized = [str(item) for item in parsed if str(item).strip()]
            if normalized:
                return normalized
    if fallback and fallback.strip():
        return [fallback]
    return []


def _bucket_sort_key(bucket: str) -> tuple[int, str]:
    priority = {
        "windows": 0,
        "system": 1,
        "user": 2,
        "downloads": 3,
        "recycle-bin": 4,
        "hidden": 5,
    }
    return priority.get(bucket, 10), bucket


@dataclass
class MutableBucketSummary:
    bucket: str
    file_count: int = 0
    total_size: int = 0


@dataclass
class MutableDriveSummary:
    drive: str
    label: str
    file_count: int = 0
    total_size: int = 0
    hidden_count: int = 0
    issue_count: int = 0


@dataclass
class ScanRuntime:
    session: ScanSessionResponse
    include_hidden: bool
    max_depth: int | None
    follow_symlinks: bool
    exclusions: list[Path]
    enabled_tools: set[str]
    tool_paths: dict[str, list[Path]]
    total_target_bytes: int
    task: asyncio.Task[None] | None = None
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    result_buffer: list[ScanResult] = field(default_factory=list)
    index_buffer: list[FileIndexEntry] = field(default_factory=list)
    issue_buffer: list[ScanIssue] = field(default_factory=list)
    bucket_totals: dict[str, MutableBucketSummary] = field(default_factory=dict)
    drive_totals: dict[str, MutableDriveSummary] = field(default_factory=dict)
    top_files: list[ScanResultResponse] = field(default_factory=list)
    recent_findings: deque[ScanResultResponse] = field(default_factory=lambda: deque(maxlen=LIVE_FINDINGS_LIMIT))
    issue_preview: deque[ScanIssueResponse] = field(default_factory=lambda: deque(maxlen=ISSUE_PREVIEW_LIMIT))
    oldest_file: ScanResultResponse | None = None
    newest_file: ScanResultResponse | None = None
    processed_index: int = 0
    started_monotonic: float = field(default_factory=time.monotonic)


class SettingsStore:
    def __init__(self) -> None:
        self._path = Path(get_settings().settings_path)

    async def load(self) -> AppSettings:
        if not self._path.exists():
            return AppSettings()

        contents = await asyncio.to_thread(self._path.read_text, "utf-8")
        return AppSettings.model_validate_json(contents)

    async def save(self, settings: AppSettings) -> AppSettings:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = settings.model_dump_json(indent=2)
        await asyncio.to_thread(self._path.write_text, payload, "utf-8")
        return settings


class ScanManager:
    def __init__(self) -> None:
        self._jobs: dict[str, ScanRuntime] = {}
        self._settings_store = SettingsStore()
        self._rules = load_rules()
        self._advisor = AIAdvisor()

    async def startup(self) -> None:
        await create_db_and_tables()

    def _get_drive_infos(self) -> list[DriveInfoResponse]:
        if platform.system() != "Windows":
            raise NotImplementedError("Drive discovery is only supported on Windows in v1.")

        drives: list[DriveInfoResponse] = []
        for partition in psutil.disk_partitions():
            if not partition.fstype or partition.fstype.lower() == "unknown":
                continue
            try:
                usage = psutil.disk_usage(partition.mountpoint)
            except OSError:
                continue
            mountpoint = partition.mountpoint.rstrip("\\") + "\\"
            drive_label = mountpoint[:2] if len(mountpoint) >= 2 else mountpoint
            drives.append(
                DriveInfoResponse(
                    id=mountpoint,
                    path=mountpoint,
                    label=drive_label,
                    fileSystem=partition.fstype,
                    totalBytes=usage.total,
                    freeBytes=usage.free,
                    usedBytes=usage.used,
                )
            )
        drives.sort(key=lambda drive: drive.path.lower())
        return drives

    async def get_system_drives(self) -> list[DriveInfoResponse]:
        return self._get_drive_infos()

    async def get_system_overview(self) -> SystemOverviewResponse:
        settings = await self.load_settings()
        drives = self._get_drive_infos()
        managed_targets = self._build_managed_targets(settings)

        async with get_session() as session:
            history_count = len((await session.execute(select(ScanSession))).scalars().all())
            last_completed = (
                await session.execute(select(ScanSession).order_by(desc(ScanSession.created_at)).limit(1))
            ).scalars().first()

        active_scan_id = next(iter(self._jobs.keys()), None)
        return SystemOverviewResponse(
            drives=drives,
            managedTargets=managed_targets,
            historyCount=history_count,
            activeScanId=active_scan_id,
            lastCompletedScanId=str(last_completed.id) if last_completed and last_completed.id is not None else None,
        )

    async def start_scan(self, request: ScanRequest) -> str:
        settings = await self.load_settings()
        drives = self._get_drive_infos()
        root_paths = request.selectedDrives or [drive.path for drive in drives]
        if not root_paths:
            raise ValueError("No drives are available to scan.")
        include_hidden = request.includeHidden if request.includeHidden is not None else settings.scanning.includeHidden
        max_depth = request.maxDepth if request.maxDepth is not None else settings.scanning.maxDepth
        follow_symlinks = settings.scanning.followSymlinks
        exclusions = [Path(path).expanduser() for path in settings.exclusions]
        enabled_tools = {
            tool for tool, enabled in settings.scanning.toolsets.model_dump().items() if enabled
        }
        tool_paths = self._resolve_tool_paths(enabled_tools)
        total_target_bytes = sum(
            drive.usedBytes for drive in drives if drive.path in root_paths
        ) or 1

        async with get_session() as session:
            db_session = ScanSession(
                root_path=root_paths[0],
                root_paths=json.dumps(root_paths),
            )
            session.add(db_session)
            await session.commit()
            await session.refresh(db_session)

        session_response = ScanSessionResponse(
            id=str(db_session.id),
            rootPaths=root_paths,
            status="scanning",
            phase="preparing",
            progress=0,
            discoveredFiles=0,
            processedFiles=0,
            bytesScanned=0,
            currentDrive=None,
            currentPath=None,
            startTime=db_session.created_at.replace(tzinfo=timezone.utc),
            summary=ScanSummaryResponse(),
        )
        runtime = ScanRuntime(
            session=session_response,
            include_hidden=include_hidden,
            max_depth=max_depth,
            follow_symlinks=follow_symlinks,
            exclusions=exclusions,
            enabled_tools=enabled_tools,
            tool_paths=tool_paths,
            total_target_bytes=total_target_bytes,
        )
        self._jobs[session_response.id] = runtime
        runtime.task = asyncio.create_task(self._run_scan(runtime))
        return session_response.id

    async def stop_scan(self, scan_id: str) -> None:
        runtime = self._require_job(scan_id)
        runtime.cancel_event.set()
        if runtime.task is not None:
            await runtime.task

    async def get_scan_status(self, scan_id: str) -> ScanSessionResponse:
        runtime = self._jobs.get(scan_id)
        if runtime is not None:
            self._refresh_session_view(runtime)
            return runtime.session

        details = await self.get_history_scan(scan_id)
        return details.session

    async def get_scan_results(self, scan_id: str) -> ScanDetailsResponse:
        return await self.get_history_scan(scan_id)

    async def list_history(self) -> list[ScanSessionResponse]:
        async with get_session() as session:
            rows = (
                await session.execute(select(ScanSession).order_by(desc(ScanSession.created_at)))
            ).scalars().all()

        history: list[ScanSessionResponse] = []
        for row in rows:
            details = await self.get_history_scan(str(row.id))
            session_summary = details.session
            session_summary.recentFindings = []
            history.append(session_summary)
        return history

    async def get_history_scan(self, scan_id: str) -> ScanDetailsResponse:
        try:
            session_id = int(scan_id)
        except ValueError as error:
            raise KeyError(f"Unknown scan session: {scan_id}") from error

        async with get_session() as session:
            row = await session.get(ScanSession, session_id)
            if row is None:
                raise KeyError(f"Unknown scan session: {scan_id}")

            result_rows = (
                await session.execute(
                    select(ScanResult)
                    .where(ScanResult.session_id == session_id)
                    .order_by(desc(ScanResult.file_size))
                )
            ).scalars().all()
            issue_rows = (
                await session.execute(
                    select(ScanIssue)
                    .where(ScanIssue.session_id == session_id)
                    .order_by(desc(ScanIssue.created_at))
                )
            ).scalars().all()

        settings = await self.load_settings()
        results = [self._result_row_to_response(result, settings) for result in result_rows]
        issues = [ScanIssueResponse(path=row.path, kind=row.kind, message=row.message) for row in issue_rows]
        session_response = self._build_session_response_from_rows(row, results, issues)
        return ScanDetailsResponse(session=session_response, results=results)

    async def clear_history(self) -> None:
        async with get_session() as session:
            await session.execute(delete(FileIndexEntry))
            await session.execute(delete(ScanIssue))
            await session.execute(delete(DeletionAudit))
            await session.execute(delete(ScanResult))
            await session.execute(delete(ScanSession))
            await session.commit()

    async def record_deleted_paths(self, file_paths: list[str], action: str) -> None:
        if not file_paths:
            return

        async with get_session() as session:
            result_rows = (
                await session.execute(
                    select(ScanResult).where(ScanResult.file_path.in_(file_paths))
                )
            ).scalars().all()
            for row in result_rows:
                session.add(
                    DeletionAudit(
                        result_id=row.id or 0,
                        action=action,
                        file_existed=False,
                        file_size_at_action=row.file_size,
                    )
                )
            await session.execute(
                delete(FileIndexEntry).where(FileIndexEntry.file_path.in_(file_paths))
            )
            await session.execute(
                delete(ScanResult).where(ScanResult.file_path.in_(file_paths))
            )
            await session.commit()

    async def load_settings(self) -> AppSettings:
        return await self._settings_store.load()

    async def save_settings(self, settings: AppSettings) -> AppSettings:
        return await self._settings_store.save(settings)

    async def test_ai_connection(self) -> None:
        settings = await self.load_settings()
        await asyncio.wait_for(self._probe_ollama(settings.ai.baseUrl), timeout=5)

    async def get_ai_advice(self, file_path: str) -> AIAdviceResponse:
        entry = await asyncio.to_thread(self._entry_from_path, Path(file_path))
        scored_item = score_item(entry, [entry])
        advice = await self._advisor.get_advice(scored_item)
        return AIAdviceResponse(
            recommendation=advice.recommendation,
            confidence=advice.confidence,
            explanation=advice.explanation,
            reasoningSignals=advice.reasoning_signals,
            similarPatterns=advice.similar_patterns,
        )

    async def learn_from_user_action(self, file_path: str, action: str, reason: str) -> None:
        entry = await asyncio.to_thread(self._entry_from_path, Path(file_path))
        scored_item = score_item(entry, [entry])
        await self._advisor.learn_from_user_action(scored_item, action, reason)

    async def query_assistant(
        self,
        query: str,
        session_id: str | None = None,
        limit: int = 8,
    ) -> AssistantQueryResponse:
        terms = [term.lower() for term in query.split() if term.strip()]
        if not terms:
            return AssistantQueryResponse(query=query, answer="No query provided.", matches=[])

        resolved_session_id: int | None
        if session_id is None:
            async with get_session() as session:
                latest = (
                    await session.execute(select(ScanSession).order_by(desc(ScanSession.created_at)).limit(1))
                ).scalars().first()
            resolved_session_id = latest.id if latest is not None else None
        else:
            try:
                resolved_session_id = int(session_id)
            except ValueError as error:
                raise KeyError(f"Unknown scan session: {session_id}") from error

        if resolved_session_id is None:
            return AssistantQueryResponse(
                query=query,
                answer="No indexed scan history is available yet.",
                matches=[],
            )

        async with get_session() as session:
            rows = (
                await session.execute(
                    select(FileIndexEntry).where(FileIndexEntry.session_id == resolved_session_id)
                )
            ).scalars().all()

        ranked: list[tuple[int, FileIndexEntry]] = []
        for row in rows:
            haystack = f"{row.file_path}\n{row.snippet}".lower()
            score = sum(2 if term in row.file_path.lower() else 1 for term in terms if term in haystack)
            if score > 0:
                ranked.append((score, row))
        ranked.sort(key=lambda item: (-item[0], -item[1].file_mtime, item[1].file_path))
        matches = [
            AssistantMatchResponse(
                path=row.file_path,
                snippet=row.snippet[:TEXT_SNIPPET_LIMIT],
                size=row.file_size,
                modifiedAt=datetime.fromtimestamp(row.file_mtime, tz=timezone.utc),
            )
            for _, row in ranked[:limit]
        ]
        if not matches:
            answer = "No indexed text or code files matched that query in the current scan history."
        else:
            first = matches[0]
            answer = (
                f"Found {len(matches)} relevant files. "
                f"The strongest match is {Path(first.path).name} at {first.path}."
            )
        return AssistantQueryResponse(query=query, answer=answer, matches=matches)

    async def _run_scan(self, runtime: ScanRuntime) -> None:
        try:
            runtime.session.phase = "scanning"
            for root_path_str in runtime.session.rootPaths:
                if runtime.cancel_event.is_set():
                    raise RuntimeError("Scan cancelled by user")

                root_path = Path(root_path_str).expanduser()
                runtime.session.currentDrive = root_path_str
                runtime.session.currentPath = root_path_str
                self._ensure_drive_summary(runtime, root_path_str)

                def on_issue(path: Path, kind: str, message: str) -> None:
                    issue = ScanIssueResponse(path=str(path), kind=kind, message=message)
                    runtime.issue_preview.appendleft(issue)
                    runtime.session.summary.issueCount += 1
                    runtime.issue_buffer.append(
                        ScanIssue(
                            session_id=int(runtime.session.id),
                            path=str(path),
                            kind=kind,
                            message=message,
                        )
                    )
                    runtime.drive_totals[root_path_str].issue_count += 1

                def should_skip(path: Path, is_dir: bool) -> bool:
                    if self._is_excluded(path, runtime.exclusions):
                        return True
                    if not runtime.include_hidden and self._is_hidden(path):
                        return True
                    return False

                for entry in walk_directory(
                    root_path,
                    follow_symlinks=runtime.follow_symlinks,
                    max_depth=runtime.max_depth,
                    on_issue=on_issue,
                    should_skip=should_skip,
                ):
                    if runtime.cancel_event.is_set():
                        raise RuntimeError("Scan cancelled by user")
                    if not entry.is_file:
                        continue

                    runtime.session.currentPath = str(entry.path.parent)
                    runtime.session.discoveredFiles += 1
                    result = self._process_entry(runtime, root_path_str, entry)
                    runtime.result_buffer.append(result["db_result"])
                    if result["index_entry"] is not None:
                        runtime.index_buffer.append(result["index_entry"])
                    runtime.session.processedFiles += 1
                    runtime.session.bytesScanned += entry.size
                    runtime.processed_index += 1

                    if (
                        len(runtime.result_buffer) >= DB_BATCH_SIZE
                        or len(runtime.index_buffer) >= DB_BATCH_SIZE
                        or len(runtime.issue_buffer) >= DB_BATCH_SIZE
                    ):
                        await self._flush_runtime_buffers(runtime)

                    if runtime.session.processedFiles % 50 == 0:
                        self._refresh_session_view(runtime)
                        await asyncio.sleep(0)

            runtime.session.phase = "finalizing"
            await self._flush_runtime_buffers(runtime)
            runtime.session.status = "completed"
            runtime.session.phase = "completed"
            runtime.session.progress = 100
            runtime.session.currentPath = None
            runtime.session.endTime = _utc_now()
            await self._finalize_scan(runtime)
            self._refresh_session_view(runtime)
        except Exception as error:
            runtime.session.status = "error"
            runtime.session.phase = "error"
            runtime.session.error = str(error)
            runtime.session.endTime = _utc_now()
            await self._flush_runtime_buffers(runtime)
            await self._finalize_scan(runtime)
            self._refresh_session_view(runtime)

    def _process_entry(
        self,
        runtime: ScanRuntime,
        drive_path: str,
        entry: ScanEntry,
    ) -> dict[str, ScanResult | FileIndexEntry | None]:
        scored_item = score_item(entry, [entry])
        adjusted_item, rule_matches = self._apply_rules(scored_item)

        is_hidden = self._is_hidden(entry.path)
        bucket = self._primary_bucket(entry.path, runtime.enabled_tools, runtime.tool_paths, is_hidden)
        drive_summary = runtime.drive_totals[drive_path]
        drive_summary.file_count += 1
        drive_summary.total_size += entry.size
        if is_hidden:
            drive_summary.hidden_count += 1
            runtime.session.summary.hiddenFiles += 1

        bucket_summary = runtime.bucket_totals.setdefault(bucket, MutableBucketSummary(bucket=bucket))
        bucket_summary.file_count += 1
        bucket_summary.total_size += entry.size

        runtime.session.summary.totalFiles += 1
        runtime.session.summary.totalSize += entry.size

        recommendation = _derive_recommendation(adjusted_item.classification)
        if recommendation == "delete":
            runtime.session.summary.deletableFiles += 1
            runtime.session.summary.deletableSize += entry.size
        elif recommendation == "review":
            runtime.session.summary.reviewFiles += 1

        live_result = ScanResultResponse(
            id=f"{runtime.session.id}:{runtime.processed_index + 1}",
            path=str(entry.path),
            size=entry.size,
            score=adjusted_item.total_score,
            classification=adjusted_item.classification,
            recommendation=recommendation,
            confidence=_derive_confidence(adjusted_item.total_score),
            modifiedAt=datetime.fromtimestamp(entry.mtime, tz=timezone.utc),
            bucket=bucket,
            drive=drive_path,
            isHidden=is_hidden,
            extension=entry.path.suffix.lower() or None,
        )
        runtime.recent_findings.appendleft(live_result)
        self._update_top_files(runtime, live_result)
        self._update_oldest_and_newest(runtime, live_result)

        index_entry = self._build_index_entry(runtime, entry)
        db_result = ScanResult(
            session_id=int(runtime.session.id),
            file_path=str(entry.path),
            file_size=entry.size,
            file_mtime=entry.mtime,
            is_directory=False,
            total_score=adjusted_item.total_score,
            classification=adjusted_item.classification,
            age_score=adjusted_item.signals["age"].score,
            age_reason=adjusted_item.signals["age"].reason,
            version_score=adjusted_item.signals["version"].score,
            version_reason=adjusted_item.signals["version"].reason,
            process_score=adjusted_item.signals["process"].score,
            process_reason=adjusted_item.signals["process"].reason,
            project_score=adjusted_item.signals["project"].score,
            project_reason=adjusted_item.signals["project"].reason,
            rule_matches=json.dumps(rule_matches),
        )
        return {"db_result": db_result, "index_entry": index_entry}

    async def _flush_runtime_buffers(self, runtime: ScanRuntime) -> None:
        if not runtime.result_buffer and not runtime.index_buffer and not runtime.issue_buffer:
            return
        async with get_session() as session:
            session.add_all(runtime.result_buffer)
            session.add_all(runtime.index_buffer)
            session.add_all(runtime.issue_buffer)
            await session.commit()
        runtime.result_buffer.clear()
        runtime.index_buffer.clear()
        runtime.issue_buffer.clear()

    async def _finalize_scan(self, runtime: ScanRuntime) -> None:
        async with get_session() as session:
            row = await session.get(ScanSession, int(runtime.session.id))
            if row is None:
                return
            row.total_files_scanned = runtime.session.summary.totalFiles
            row.total_size_scanned = runtime.session.summary.totalSize
            started = runtime.session.startTime or _utc_now()
            ended = runtime.session.endTime or _utc_now()
            row.scan_duration_seconds = max((ended - started).total_seconds(), 0.0)
            session.add(row)
            await session.commit()

    def _update_top_files(self, runtime: ScanRuntime, result: ScanResultResponse) -> None:
        runtime.top_files.append(result)
        runtime.top_files.sort(key=lambda item: (-item.size, item.path))
        del runtime.top_files[TOP_FILES_LIMIT:]

    def _update_oldest_and_newest(self, runtime: ScanRuntime, result: ScanResultResponse) -> None:
        if runtime.oldest_file is None or result.modifiedAt < runtime.oldest_file.modifiedAt:
            runtime.oldest_file = result
        if runtime.newest_file is None or result.modifiedAt > runtime.newest_file.modifiedAt:
            runtime.newest_file = result

    def _refresh_session_view(self, runtime: ScanRuntime) -> None:
        progress = min((runtime.session.bytesScanned / max(runtime.total_target_bytes, 1)) * 100, 99.5)
        if runtime.session.status == "completed":
            progress = 100
        runtime.session.progress = round(progress, 2)
        elapsed = max(time.monotonic() - runtime.started_monotonic, 0.001)
        if runtime.session.status == "scanning" and runtime.session.bytesScanned > 0:
            remaining = max(runtime.total_target_bytes - runtime.session.bytesScanned, 0)
            rate = runtime.session.bytesScanned / elapsed
            runtime.session.etaSeconds = int(remaining / rate) if rate > 0 else None
        else:
            runtime.session.etaSeconds = None
        runtime.session.driveSummaries = [
            DriveSummaryResponse(
                drive=item.drive,
                label=item.label,
                fileCount=item.file_count,
                totalSize=item.total_size,
                hiddenCount=item.hidden_count,
                issueCount=item.issue_count,
            )
            for item in sorted(runtime.drive_totals.values(), key=lambda drive: drive.drive.lower())
        ]
        runtime.session.bucketSummaries = [
            BucketSummaryResponse(
                bucket=item.bucket,
                label=BUCKET_LABELS.get(item.bucket, item.bucket.title()),
                fileCount=item.file_count,
                totalSize=item.total_size,
            )
            for item in sorted(runtime.bucket_totals.values(), key=lambda bucket: _bucket_sort_key(bucket.bucket))
        ]
        runtime.session.topFiles = list(runtime.top_files)
        runtime.session.oldestFile = runtime.oldest_file
        runtime.session.newestFile = runtime.newest_file
        runtime.session.recentFindings = list(runtime.recent_findings)
        runtime.session.issues = list(runtime.issue_preview)

    def _build_session_response_from_rows(
        self,
        row: ScanSession,
        results: list[ScanResultResponse],
        issues: list[ScanIssueResponse],
    ) -> ScanSessionResponse:
        root_paths = _deserialize_root_paths(row.root_paths, row.root_path)
        summary = ScanSummaryResponse(
            totalFiles=len(results),
            totalSize=sum(result.size for result in results),
            hiddenFiles=sum(1 for result in results if result.isHidden),
            issueCount=len(issues),
            deletableFiles=sum(1 for result in results if result.recommendation == "delete"),
            deletableSize=sum(result.size for result in results if result.recommendation == "delete"),
            reviewFiles=sum(1 for result in results if result.recommendation == "review"),
        )
        drive_map: dict[str, MutableDriveSummary] = {}
        bucket_map: dict[str, MutableBucketSummary] = {}
        for drive in root_paths:
            drive_map[drive] = MutableDriveSummary(drive=drive, label=drive[:2] if len(drive) >= 2 else drive)
        for result in results:
            drive_summary = drive_map.setdefault(
                result.drive,
                MutableDriveSummary(drive=result.drive, label=result.drive[:2] if len(result.drive) >= 2 else result.drive),
            )
            drive_summary.file_count += 1
            drive_summary.total_size += result.size
            if result.isHidden:
                drive_summary.hidden_count += 1

            bucket_summary = bucket_map.setdefault(
                result.bucket, MutableBucketSummary(bucket=result.bucket)
            )
            bucket_summary.file_count += 1
            bucket_summary.total_size += result.size
        for issue in issues:
            drive = self._drive_for_path(Path(issue.path))
            drive_summary = drive_map.setdefault(
                drive,
                MutableDriveSummary(drive=drive, label=drive[:2] if len(drive) >= 2 else drive),
            )
            drive_summary.issue_count += 1

        top_files = sorted(results, key=lambda result: (-result.size, result.path))[:TOP_FILES_LIMIT]
        oldest = min(results, key=lambda result: result.modifiedAt, default=None)
        newest = max(results, key=lambda result: result.modifiedAt, default=None)
        start_time = row.created_at.replace(tzinfo=timezone.utc)
        end_time = start_time + timedelta(seconds=max(row.scan_duration_seconds, 0.0))
        return ScanSessionResponse(
            id=str(row.id),
            rootPaths=root_paths,
            status="completed",
            phase="completed",
            progress=100,
            discoveredFiles=len(results),
            processedFiles=len(results),
            bytesScanned=summary.totalSize,
            etaSeconds=None,
            currentDrive=None,
            currentPath=None,
            startTime=start_time,
            endTime=end_time,
            summary=summary,
            driveSummaries=[
                DriveSummaryResponse(
                    drive=item.drive,
                    label=item.label,
                    fileCount=item.file_count,
                    totalSize=item.total_size,
                    hiddenCount=item.hidden_count,
                    issueCount=item.issue_count,
                )
                for item in sorted(drive_map.values(), key=lambda drive: drive.drive.lower())
            ],
            bucketSummaries=[
                BucketSummaryResponse(
                    bucket=item.bucket,
                    label=BUCKET_LABELS.get(item.bucket, item.bucket.title()),
                    fileCount=item.file_count,
                    totalSize=item.total_size,
                )
                for item in sorted(bucket_map.values(), key=lambda bucket: _bucket_sort_key(bucket.bucket))
            ],
            topFiles=top_files,
            oldestFile=oldest,
            newestFile=newest,
            recentFindings=top_files[:LIVE_FINDINGS_LIMIT],
            issues=issues[:ISSUE_PREVIEW_LIMIT],
        )

    def _result_row_to_response(self, row: ScanResult, settings: AppSettings) -> ScanResultResponse:
        path = Path(row.file_path)
        is_hidden = self._is_hidden(path)
        tool_paths = self._resolve_tool_paths(
            {tool for tool, enabled in settings.scanning.toolsets.model_dump().items() if enabled}
        )
        bucket = self._primary_bucket(
            path,
            {tool for tool, enabled in settings.scanning.toolsets.model_dump().items() if enabled},
            tool_paths,
            is_hidden,
        )
        drive = self._drive_for_path(path)
        return ScanResultResponse(
            id=str(row.id),
            path=row.file_path,
            size=row.file_size,
            score=row.total_score,
            classification=row.classification,  # type: ignore[arg-type]
            recommendation=_derive_recommendation(row.classification),  # type: ignore[arg-type]
            confidence=_derive_confidence(row.total_score),
            modifiedAt=datetime.fromtimestamp(row.file_mtime, tz=timezone.utc),
            bucket=bucket,
            drive=drive,
            isHidden=is_hidden,
            extension=path.suffix.lower() or None,
        )

    def _build_index_entry(self, runtime: ScanRuntime, entry: ScanEntry) -> FileIndexEntry | None:
        if entry.size > TEXT_INDEX_LIMIT_BYTES:
            return None
        if entry.path.suffix.lower() not in TEXT_EXTENSIONS:
            return None
        try:
            raw = entry.path.read_bytes()
        except OSError:
            return None
        if b"\x00" in raw[:1024]:
            return None
        text = raw.decode("utf-8", errors="ignore").strip()
        if not text:
            return None
        snippet = " ".join(text.split())[:TEXT_SNIPPET_LIMIT]
        return FileIndexEntry(
            session_id=int(runtime.session.id),
            file_path=str(entry.path),
            file_size=entry.size,
            file_mtime=entry.mtime,
            snippet=snippet,
        )

    def _resolve_tool_paths(self, enabled_tools: set[str]) -> dict[str, list[Path]]:
        resolved: dict[str, list[Path]] = {}
        for tool_name in enabled_tools:
            try:
                resolved[tool_name] = [path for path in get_tool_paths(ToolName(tool_name)) if path.exists()]
            except Exception:
                resolved[tool_name] = []
        return resolved

    def _build_managed_targets(self, settings: AppSettings) -> list[ManagedTargetResponse]:
        enabled_tools = {
            tool for tool, enabled in settings.scanning.toolsets.model_dump().items() if enabled
        }
        tool_paths = self._resolve_tool_paths(enabled_tools)
        labels = {
            "vscode": "VS Code cache and workspace data",
            "android": "Android SDK and IDE data",
            "node": "Node.js and npm caches",
            "python": "Python caches and virtualenv artifacts",
        }
        targets: list[ManagedTargetResponse] = []
        for tool_name in sorted(enabled_tools):
            for path in tool_paths.get(tool_name, []):
                targets.append(
                    ManagedTargetResponse(
                        tool=tool_name,
                        label=labels.get(tool_name, tool_name),
                        path=str(path),
                        exists=path.exists(),
                    )
                )
        return targets

    def _ensure_drive_summary(self, runtime: ScanRuntime, drive_path: str) -> None:
        runtime.drive_totals.setdefault(
            drive_path,
            MutableDriveSummary(
                drive=drive_path,
                label=drive_path[:2] if len(drive_path) >= 2 else drive_path,
            ),
        )

    def _is_excluded(self, path: Path, exclusions: list[Path]) -> bool:
        return any(_is_under_path(path, exclusion) for exclusion in exclusions)

    def _primary_bucket(
        self,
        path: Path,
        enabled_tools: set[str],
        tool_paths: dict[str, list[Path]],
        is_hidden: bool,
    ) -> str:
        windows_dir = Path(os.environ.get("WINDIR", "C:\\Windows"))
        if _is_under_path(path, windows_dir):
            return "windows"

        system_paths = [
            Path(os.environ.get("ProgramFiles", "C:\\Program Files")),
            Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")),
            Path(os.environ.get("ProgramData", "C:\\ProgramData")),
        ]
        if any(_is_under_path(path, system_path) for system_path in system_paths):
            return "system"

        downloads_dir = Path.home() / "Downloads"
        if _is_under_path(path, downloads_dir):
            return "downloads"

        if "$recycle.bin" in _normalize_path(path):
            return "recycle-bin"

        home_dir = Path.home()
        if _is_under_path(path, home_dir):
            for tool_name in sorted(enabled_tools):
                if any(_is_under_path(path, tool_path) for tool_path in tool_paths.get(tool_name, [])):
                    return f"tool:{tool_name}"
            return "user"

        if is_hidden:
            return "hidden"

        for tool_name in sorted(enabled_tools):
            if any(_is_under_path(path, tool_path) for tool_path in tool_paths.get(tool_name, [])):
                return f"tool:{tool_name}"

        return "other"

    def _drive_for_path(self, path: Path) -> str:
        if platform.system() == "Windows":
            drive = path.drive or path.anchor
            if drive and not drive.endswith("\\"):
                drive = f"{drive}\\"
            return drive or str(path.anchor or path)
        return path.anchor or "/"

    def _is_hidden(self, path: Path) -> bool:
        if any(part.startswith(".") for part in path.parts if part not in {path.anchor, ""}):
            return True
        try:
            stat_result = path.stat()
        except OSError:
            return False
        file_attributes = getattr(stat_result, "st_file_attributes", 0)
        hidden_flag = getattr(stat, "FILE_ATTRIBUTE_HIDDEN", 0)
        return bool(file_attributes & hidden_flag)

    def _apply_rules(self, item: ScoredItem) -> tuple[ScoredItem, list[str]]:
        total_score = item.total_score
        classification = item.classification
        matched_descriptions: list[str] = []

        for tool_rules in self._rules.values():
            matches = get_matching_rules(item.entry.path, tool_rules)
            for description, adjustment, override in matches:
                matched_descriptions.append(description)
                total_score = max(0, min(100, total_score + adjustment))
                if override is not None:
                    classification = override

        if not matched_descriptions or classification == item.classification:
            classification = _apply_threshold(total_score)

        return (
            ScoredItem(
                entry=item.entry,
                total_score=total_score,
                classification=classification,
                signals=item.signals,
            ),
            matched_descriptions,
        )

    def _require_job(self, scan_id: str) -> ScanRuntime:
        runtime = self._jobs.get(scan_id)
        if runtime is None:
            raise KeyError(f"Unknown scan session: {scan_id}")
        return runtime

    def _entry_from_path(self, file_path: Path) -> ScanEntry:
        stat_result = file_path.stat()
        return ScanEntry(
            path=file_path,
            size=stat_result.st_size,
            mtime=stat_result.st_mtime,
            is_dir=file_path.is_dir(),
            is_file=file_path.is_file(),
            is_symlink=file_path.is_symlink(),
        )

    async def _probe_ollama(self, base_url: str) -> None:
        import urllib.request

        def ping() -> None:
            with urllib.request.urlopen(f"{base_url.rstrip('/')}/api/tags", timeout=3) as response:
                response.read()

        await asyncio.to_thread(ping)


scan_manager = ScanManager()
