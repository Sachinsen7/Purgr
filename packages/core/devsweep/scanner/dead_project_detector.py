"""
Dead project detection - finds inactive development projects.

A dead project is defined as:
- Has a node_modules or similar artifact directory
- Last git commit was > 90 days ago
"""

from __future__ import annotations

import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import NamedTuple

import structlog

logger = structlog.get_logger()

DEAD_PROJECT_DAYS = 90


class DeadProject(NamedTuple):
    """Represents a detected dead/inactive project."""
    path: Path
    artifact_size: int  # e.g., node_modules size in bytes
    last_commit: datetime | None
    days_inactive: int
    artifact_type: str  # "node_modules", "cargo", "venv", etc.


def _get_last_git_commit_date(project_path: Path) -> datetime | None:
    """
    Get the date of the last git commit in a project.
    
    Returns None if not a git repo or git command fails.
    """
    if not (project_path / ".git").exists():
        return None
    
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct"],
            cwd=str(project_path),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return None
        
        timestamp = int(result.stdout.strip())
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)
    except (subprocess.TimeoutExpired, ValueError, OSError):
        return None


def _get_directory_size(path: Path) -> int:
    """Calculate total size of a directory tree."""
    total_size = 0
    try:
        for entry in path.rglob("*"):
            try:
                if entry.is_file(follow_symlinks=False):
                    total_size += entry.stat().st_size
            except (OSError, PermissionError):
                continue
    except (OSError, PermissionError):
        pass
    return total_size


def find_dead_projects(search_locations: list[Path]) -> list[DeadProject]:
    """
    Find dead/inactive projects in given locations.
    
    Searches for common artifact directories (node_modules, venv, .cargo, etc.)
    and checks if the parent project hasn't been committed to in > 90 days.
    """
    dead_projects: list[DeadProject] = []
    artifact_patterns = [
        ("node_modules", "node_modules"),
        ("venv", "python_venv"),
        ("env", "python_env"),
        (".venv", "python_venv"),
        ("target", "rust_cargo"),
        (".gradle", "gradle"),
    ]
    
    for search_location in search_locations:
        if not search_location.is_dir():
            continue
        
        logger.debug("Scanning for dead projects", location=str(search_location))
        
        try:
            for item in search_location.iterdir():
                if not item.is_dir():
                    continue
                
                # Check if this directory has any artifact indicators
                for artifact_name, artifact_type in artifact_patterns:
                    artifact_path = item / artifact_name
                    if artifact_path.exists():
                        last_commit = _get_last_git_commit_date(item)
                        
                        if last_commit is not None:
                            days_since = (
                                datetime.now(timezone.utc) - last_commit
                            ).days
                            
                            if days_since > DEAD_PROJECT_DAYS:
                                artifact_size = _get_directory_size(artifact_path)
                                dead_project = DeadProject(
                                    path=item,
                                    artifact_size=artifact_size,
                                    last_commit=last_commit,
                                    days_inactive=days_since,
                                    artifact_type=artifact_type,
                                )
                                dead_projects.append(dead_project)
                                logger.info(
                                    "Found dead project",
                                    path=str(item),
                                    days_inactive=days_since,
                                    artifact_size=artifact_size,
                                )
                        break  # Don't check other artifacts for this dir
        except (OSError, PermissionError) as error:
            logger.debug(
                "Error scanning directory for dead projects",
                location=str(search_location),
                error=str(error),
            )
            continue
    
    return dead_projects
