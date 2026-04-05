from typing import List

from .. import signals
from ..models import ScanEntry, ScoredItem, SignalResult


def _coerce_signal_result(result: object) -> SignalResult:
    if isinstance(result, SignalResult):
        return result

    score = getattr(result, "score", 0)
    reason = getattr(result, "reason", "")
    return SignalResult(score=int(score), reason=str(reason))


def score_item(entry: ScanEntry, all_entries: List[ScanEntry]) -> ScoredItem:
    signal_map = {}
    
    # Calculate all signals
    signal_map["age"] = _coerce_signal_result(signals.calculate_age_signal(entry))
    signal_map["version"] = _coerce_signal_result(
        signals.calculate_version_signal(entry, all_entries)
    )
    signal_map["process"] = _coerce_signal_result(signals.calculate_process_signal(entry))
    signal_map["project"] = _coerce_signal_result(signals.calculate_project_signal(entry))
    
    # Aggregate score - weighted average
    weights = {
        "age": 0.4,      # Age is most important
        "version": 0.3,  # Version siblings are good indicator
        "process": 0.2,  # Active processes block deletion
        "project": 0.1,  # Project activity is least important
    }
    
    total_score = 0
    for signal_name, signal_result in signal_map.items():
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
        signals=signal_map,
    )
