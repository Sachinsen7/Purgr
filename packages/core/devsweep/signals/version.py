import re
from pathlib import Path
from typing import List

from ..models import ScanEntry, SignalResult


def calculate_version_signal(entry: ScanEntry, all_entries: List[ScanEntry]) -> SignalResult:
    if entry.is_dir:
        return SignalResult(score=0, reason="Directories are not scored by version")
    
    parent = entry.path.parent
    stem = entry.path.stem
    suffix = entry.path.suffix
    
    # Look for sibling files with similar names indicating versions
    version_patterns = [
        re.compile(rf"^{re.escape(stem)}\(\d+\){re.escape(suffix)}$"),  # file(1).txt
        re.compile(rf"^{re.escape(stem)}\.\w+{re.escape(suffix)}$"),    # file.backup.txt
        re.compile(rf"^{re.escape(stem)}_v\d+{re.escape(suffix)}$"),    # file_v1.txt
        re.compile(rf"^{re.escape(stem)}\d+{re.escape(suffix)}$"),      # file1.txt (if base exists)
    ]
    
    sibling_count = 0
    has_base_version = False
    
    # Check if there's a base file without version
    base_path = parent / f"{stem}{suffix}"
    if any(e.path == base_path for e in all_entries):
        has_base_version = True
    
    # Count versioned siblings
    for pattern in version_patterns:
        for other_entry in all_entries:
            if other_entry.path != entry.path and pattern.match(other_entry.path.name):
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
