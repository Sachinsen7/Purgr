import time
from typing import Optional

from ..models import ScanEntry, SignalResult


def calculate_age_signal(entry: ScanEntry) -> SignalResult:
    if entry.is_dir:
        return SignalResult(score=0, reason="Directories are not scored by age")
    
    current_time = time.time()
    age_seconds = current_time - entry.mtime
    
    # Convert to days
    age_days = age_seconds / (24 * 3600)
    
    # Score based on age: linear scale from 0 to 100 over 365 days
    if age_days <= 0:
        score = 0
    elif age_days >= 365:
        score = 100
    else:
        score = int((age_days / 365) * 100)
    
    reason = f"File is {age_days:.1f} days old"
    return SignalResult(score=score, reason=reason)
