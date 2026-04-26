import re
from pathlib import Path
from typing import List

from ..models import ScanEntry, SignalResult


def _normalize_version_stem(stem: str) -> str:
    normalized = stem
    version_suffixes = (
        r"\(\d+\)$",         # file(1)
        r"_v\d+$",           # file_v2
        r"\d+$",             # file2
        r"\.[A-Za-z0-9_-]+$",  # file.backup
    )

    for pattern in version_suffixes:
        updated = re.sub(pattern, "", normalized)
        if updated != normalized:
            normalized = updated
            break

    return normalized


def calculate_version_signal(entry: ScanEntry, all_entries: List[ScanEntry]) -> SignalResult:
    if entry.is_dir:
        return SignalResult(score=0, reason="Directories are not scored by version")

    target_parent = entry.path.parent
    target_suffix = entry.path.suffix
    target_family = _normalize_version_stem(entry.path.stem)

    sibling_count = 0
    for other_entry in all_entries:
        if other_entry.path == entry.path or other_entry.is_dir:
            continue
        if other_entry.path.parent != target_parent:
            continue
        if other_entry.path.suffix != target_suffix:
            continue

        other_family = _normalize_version_stem(other_entry.path.stem)
        if other_family == target_family:
            sibling_count += 1

    # Score based on number of versioned siblings
    if sibling_count == 0:
        score = 0
        reason = "No versioned siblings found"
    elif sibling_count == 1:
        score = 30
        reason = f"One versioned sibling found"
    elif sibling_count <= 3:
        score = 60
        reason = f"{sibling_count} versioned siblings found"
    else:
        score = 90
        reason = f"Many versioned siblings ({sibling_count}) found"
    
    return SignalResult(score=score, reason=reason)
