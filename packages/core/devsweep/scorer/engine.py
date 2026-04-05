from typing import List

from ..models import ScanEntry, ScoredItem, SignalResult
from ..signals import (
    calculate_age_signal,
    calculate_version_signal,
    calculate_process_signal,
    calculate_project_signal,
)


def score_item(entry: ScanEntry, all_entries: List[ScanEntry]) -> ScoredItem:
    signals = {}
    
    # Calculate all signals
    signals["age"] = calculate_age_signal(entry)
    signals["version"] = calculate_version_signal(entry, all_entries)
    signals["process"] = calculate_process_signal(entry)
    signals["project"] = calculate_project_signal(entry)
    
    # Aggregate score - weighted average
    weights = {
        "age": 0.4,      # Age is most important
        "version": 0.3,  # Version siblings are good indicator
        "process": 0.2,  # Active processes block deletion
        "project": 0.1,  # Project activity is least important
    }
    
    total_score = 0
    for signal_name, signal_result in signals.items():
        total_score += signal_result.score * weights[signal_name]
    
    total_score = int(total_score)
    
    # Apply classification thresholds
    if total_score <= 20:
        classification = "safe"
    elif total_score <= 70:
        classification = "optional"
    else:
        classification = "critical"
    
    return ScoredItem(
        entry=entry,
        total_score=total_score,
        classification=classification,
        signals=signals,
    )
