import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Iterator

import structlog

from ..models import ScanEntry

logger = structlog.get_logger()


def walk_directory(root_path: Path) -> Iterator[ScanEntry]:
    def scan_dir(dir_path: Path) -> Iterator[ScanEntry]:
        try:
            with os.scandir(dir_path) as entries:
                for entry in entries:
                    path = Path(entry.path)
                    try:
                        stat = entry.stat()
                        yield ScanEntry(
                            path=path,
                            size=stat.st_size,
                            mtime=stat.st_mtime,
                            is_dir=entry.is_dir(),
                            is_file=entry.is_file(),
                            is_symlink=entry.is_symlink(),
                        )
                        if entry.is_dir(follow_symlinks=False):
                            yield from scan_dir(path)
                    except (OSError, PermissionError) as e:
                        logger.warning(
                            "Failed to stat entry",
                            path=str(path),
                            error=str(e),
                        )
        except (OSError, PermissionError) as e:
            logger.warning(
                "Failed to scan directory",
                path=str(dir_path),
                error=str(e),
            )

    with ThreadPoolExecutor() as executor:
        futures = [executor.submit(scan_dir, root_path)]
        for future in as_completed(futures):
            try:
                yield from future.result()
            except Exception as e:
                logger.error(
                    "Error in directory scan task",
                    error=str(e),
                )
