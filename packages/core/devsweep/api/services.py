from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from sqlmodel import delete, select

from ..ai.advisor import AIAdvisor
from ..config.settings import get_settings
from ..db.models import DeletionAudit, ScanResult, ScanSession
from ..db.session import create_db_and_tables, get_session
from ..models import ScanEntry, ScoredItem
from ..rules.loader import get_matching_rules, load_rules
from ..scanner.walker import walk_directory
from ..scorer.engine import score_item
from .schemas import (
    AIAdviceResponse,
    AppSettings,
    ScanRequest,
    ScanResultResponse,
    ScanSessionResponse,
)


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


@dataclass
class ScanRuntime:
    session: ScanSessionResponse
    scored_items: dict[str, ScoredItem] = field(default_factory=dict)
    task: asyncio.Task[None] | None = None
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)


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

    async def start_scan(self, request: ScanRequest) -> str:
        session_id = str(uuid4())
        session = ScanSessionResponse(
            id=session_id,
            rootPath=request.rootPath,
            status="scanning",
            progress=0,
            totalFiles=0,
            scannedFiles=0,
            results=[],
            startTime=_utc_now(),
        )
        runtime = ScanRuntime(session=session)
        runtime.task = asyncio.create_task(self._run_scan(runtime, request))
        self._jobs[session_id] = runtime
        return session_id

    async def stop_scan(self, scan_id: str) -> None:
        runtime = self._require_job(scan_id)
        runtime.cancel_event.set()
        if runtime.task is not None:
            await runtime.task

    async def get_scan_status(self, scan_id: str) -> ScanSessionResponse:
        return self._require_job(scan_id).session

    async def get_scan_results(self, scan_id: str) -> list[ScanResultResponse]:
        return self._require_job(scan_id).session.results

    async def list_history(self) -> list[ScanSessionResponse]:
        history: list[ScanSessionResponse] = []
        async with get_session() as session:
            rows = await session.exec(select(ScanSession).order_by(ScanSession.created_at.desc()))
            for row in rows:
                results_query = await session.exec(
                    select(ScanResult).where(ScanResult.session_id == row.id)
                )
                results = [
                    ScanResultResponse(
                        id=str(result.id),
                        path=result.file_path,
                        size=result.file_size,
                        score=result.total_score,
                        classification=result.classification,
                        recommendation=_derive_recommendation(result.classification),
                        confidence=_derive_confidence(result.total_score),
                    )
                    for result in results_query
                ]
                history.append(
                    ScanSessionResponse(
                        id=str(row.id),
                        rootPath=row.root_path,
                        status="completed",
                        progress=100,
                        totalFiles=row.total_files_scanned,
                        scannedFiles=row.total_files_scanned,
                        results=results,
                        startTime=row.created_at,
                        endTime=row.created_at,
                    )
                )
        return history

    async def clear_history(self) -> None:
        async with get_session() as session:
            await session.exec(delete(DeletionAudit))
            await session.exec(delete(ScanResult))
            await session.exec(delete(ScanSession))
            await session.commit()

    async def load_settings(self) -> AppSettings:
        return await self._settings_store.load()

    async def save_settings(self, settings: AppSettings) -> AppSettings:
        return await self._settings_store.save(settings)

    async def test_ai_connection(self) -> None:
        settings = await self.load_settings()
        await asyncio.wait_for(self._probe_ollama(settings.ai.baseUrl), timeout=5)

    async def get_ai_advice(self, file_path: str) -> AIAdviceResponse:
        scored_item = self._find_scored_item(file_path)
        if scored_item is None:
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
        scored_item = self._find_scored_item(file_path)
        if scored_item is None:
            entry = await asyncio.to_thread(self._entry_from_path, Path(file_path))
            scored_item = score_item(entry, [entry])
        await self._advisor.learn_from_user_action(scored_item, action, reason)

    async def _run_scan(self, runtime: ScanRuntime, request: ScanRequest) -> None:
        root_path = Path(request.rootPath).expanduser()
        try:
            entries = await asyncio.to_thread(
                self._collect_entries,
                root_path,
                request.includeHidden,
                request.maxDepth,
            )
            file_entries = [entry for entry in entries if entry.is_file]
            runtime.session.totalFiles = len(file_entries)

            results: list[ScanResultResponse] = []
            for index, entry in enumerate(file_entries, start=1):
                if runtime.cancel_event.is_set():
                    runtime.session.status = "error"
                    runtime.session.error = "Scan cancelled by user"
                    break

                scored_item = score_item(entry, entries)
                adjusted_item, _ = self._apply_rules(scored_item)
                runtime.scored_items[str(adjusted_item.entry.path)] = adjusted_item
                results.append(
                    ScanResultResponse(
                        id=str(uuid4()),
                        path=str(adjusted_item.entry.path),
                        size=adjusted_item.entry.size,
                        score=adjusted_item.total_score,
                        classification=adjusted_item.classification,
                        recommendation=_derive_recommendation(adjusted_item.classification),
                        confidence=_derive_confidence(adjusted_item.total_score),
                    )
                )
                runtime.session.scannedFiles = index
                runtime.session.progress = round((index / max(len(file_entries), 1)) * 100, 2)
                runtime.session.results = results

            if runtime.session.status != "error":
                runtime.session.status = "completed"
                runtime.session.progress = 100

            runtime.session.endTime = _utc_now()
            await self._persist_scan(runtime, request.rootPath)
        except Exception as error:
            runtime.session.status = "error"
            runtime.session.error = str(error)
            runtime.session.endTime = _utc_now()

    async def _persist_scan(self, runtime: ScanRuntime, root_path: str) -> None:
        if runtime.session.startTime is None:
            return

        async with get_session() as session:
            db_session = ScanSession(
                root_path=root_path,
                total_files_scanned=runtime.session.scannedFiles,
                total_size_scanned=sum(result.size for result in runtime.session.results),
                scan_duration_seconds=(
                    (runtime.session.endTime or _utc_now()) - runtime.session.startTime
                ).total_seconds(),
            )
            session.add(db_session)
            await session.commit()
            await session.refresh(db_session)

            for result in runtime.session.results:
                scored_item = runtime.scored_items.get(result.path)
                if scored_item is None:
                    continue

                session.add(
                    ScanResult(
                        session_id=db_session.id or 0,
                        file_path=result.path,
                        file_size=result.size,
                        file_mtime=scored_item.entry.mtime,
                        is_directory=False,
                        total_score=result.score,
                        classification=result.classification,
                        age_score=scored_item.signals["age"].score,
                        age_reason=scored_item.signals["age"].reason,
                        version_score=scored_item.signals["version"].score,
                        version_reason=scored_item.signals["version"].reason,
                        process_score=scored_item.signals["process"].score,
                        process_reason=scored_item.signals["process"].reason,
                        project_score=scored_item.signals["project"].score,
                        project_reason=scored_item.signals["project"].reason,
                        rule_matches=json.dumps(self._collect_rule_matches(scored_item.entry.path)),
                    )
                )

            await session.commit()

    def _require_job(self, scan_id: str) -> ScanRuntime:
        runtime = self._jobs.get(scan_id)
        if runtime is None:
            raise KeyError(f"Unknown scan session: {scan_id}")
        return runtime

    def _collect_entries(
        self,
        root_path: Path,
        include_hidden: bool,
        max_depth: int | None,
    ) -> list[ScanEntry]:
        entries: list[ScanEntry] = []
        for entry in walk_directory(root_path):
            if not include_hidden and any(part.startswith(".") for part in entry.path.parts):
                continue
            if max_depth is not None:
                try:
                    depth = len(entry.path.relative_to(root_path).parts)
                except ValueError:
                    continue
                if depth > max_depth:
                    continue
            entries.append(entry)
        return entries

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

    def _collect_rule_matches(self, file_path: Path) -> list[str]:
        matches: list[str] = []
        for tool_rules in self._rules.values():
            matches.extend(description for description, _, _ in get_matching_rules(file_path, tool_rules))
        return matches

    def _find_scored_item(self, file_path: str) -> ScoredItem | None:
        for runtime in self._jobs.values():
            scored_item = runtime.scored_items.get(file_path)
            if scored_item is not None:
                return scored_item
        return None

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
