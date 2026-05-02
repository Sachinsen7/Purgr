import asyncio
from pathlib import Path

import pytest

from devsweep.api.services import ScanManager
from devsweep.models import ScanEntry


@pytest.mark.asyncio
async def test_stream_walk_events_emits_entries_and_reports_issues(monkeypatch):
    manager = ScanManager()
    root = Path("C:/scan-root")

    def slow_walk_directory(
        root_path: Path,
        *,
        follow_symlinks: bool = False,
        max_depth: int | None = None,
        on_issue=None,
        should_skip=None,
        should_descend=None,
    ):
        del root_path, follow_symlinks, max_depth, should_skip, should_descend
        yield ScanEntry(
            path=root / "first.txt",
            size=12,
            mtime=1.0,
            is_dir=False,
            is_file=True,
            is_symlink=False,
        )
        if on_issue is not None:
            on_issue(root / "locked", "protected", "Access denied")
        yield ScanEntry(
            path=root / "second.txt",
            size=16,
            mtime=2.0,
            is_dir=False,
            is_file=True,
            is_symlink=False,
        )

    monkeypatch.setattr(
        "devsweep.api.services.walk_directory",
        slow_walk_directory,
    )

    events = []
    issues = []

    async for event in manager._stream_walk_events(
        root,
        follow_symlinks=False,
        max_depth=None,
        should_skip=lambda *_: False,
        cancel_event=asyncio.Event(),
        on_issue=lambda *issue: issues.append(issue),
    ):
        events.append(event)

    assert len(events) == 2
    assert len(issues) == 1
    assert isinstance(events[0], ScanEntry)
    assert isinstance(events[1], ScanEntry)
