from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from pathlib import Path

import structlog

from ..models import ScanEntry

logger = structlog.get_logger()

IssueCallback = Callable[[Path, str, str], None]
SkipCallback = Callable[[Path, bool], bool]


def walk_directory(
    root_path: Path,
    *,
    follow_symlinks: bool = False,
    max_depth: int | None = None,
    on_issue: IssueCallback | None = None,
    should_skip: SkipCallback | None = None,
) -> Iterator[ScanEntry]:
    def emit_issue(path: Path, kind: str, message: str) -> None:
        logger.warning("Scan issue", path=str(path), kind=kind, message=message)
        if on_issue is not None:
            on_issue(path, kind, message)

    def scan_dir(dir_path: Path, depth: int) -> Iterator[ScanEntry]:
        if max_depth is not None and depth > max_depth:
            return
        try:
            with os.scandir(dir_path) as entries:
                for dir_entry in entries:
                    path = Path(dir_entry.path)
                    try:
                        is_dir = dir_entry.is_dir(follow_symlinks=follow_symlinks)
                        if should_skip is not None and should_skip(path, is_dir):
                            continue

                        stat_result = dir_entry.stat(follow_symlinks=follow_symlinks)
                        entry = ScanEntry(
                            path=path,
                            size=stat_result.st_size,
                            mtime=stat_result.st_mtime,
                            is_dir=is_dir,
                            is_file=dir_entry.is_file(follow_symlinks=follow_symlinks),
                            is_symlink=dir_entry.is_symlink(),
                        )
                        yield entry

                        if is_dir and (follow_symlinks or not dir_entry.is_symlink()):
                            yield from scan_dir(path, depth + 1)
                    except (OSError, PermissionError) as error:
                        kind = "protected" if isinstance(error, PermissionError) else "unreadable"
                        emit_issue(path, kind, str(error))
        except (OSError, PermissionError) as error:
            kind = "protected" if isinstance(error, PermissionError) else "unreadable"
            emit_issue(dir_path, kind, str(error))

    yield from scan_dir(root_path, 0)
