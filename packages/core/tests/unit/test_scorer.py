import time
from pathlib import Path
from unittest.mock import patch

from devsweep.models import ScanEntry, ScoredItem
from devsweep.scorer.engine import score_item


def test_score_item_safe_classification():
    entry = ScanEntry(
        path=Path("/test/file.txt"),
        size=100,
        mtime=time.time() - (30 * 24 * 3600),  # 30 days old
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    all_entries = [entry]
    
    with patch("devsweep.signals.calculate_age_signal") as mock_age, \
         patch("devsweep.signals.calculate_version_signal") as mock_version, \
         patch("devsweep.signals.calculate_process_signal") as mock_process, \
         patch("devsweep.signals.calculate_project_signal") as mock_project:
        
        # Mock signals to return low scores
        mock_age.return_value.score = 10
        mock_version.return_value.score = 5
        mock_process.return_value.score = 0
        mock_project.return_value.score = 5
        
        result = score_item(entry, all_entries)
        
        assert isinstance(result, ScoredItem)
        assert result.entry == entry
        assert result.total_score == 7  # (10*0.4 + 5*0.3 + 0*0.2 + 5*0.1) = 7
        assert result.classification == "safe"
        assert "age" in result.signals
        assert "version" in result.signals
        assert "process" in result.signals
        assert "project" in result.signals


def test_score_item_critical_classification():
    entry = ScanEntry(
        path=Path("/test/old_file.txt"),
        size=100,
        mtime=time.time() - (400 * 24 * 3600),  # Very old
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    all_entries = [entry]
    
    with patch("devsweep.signals.calculate_age_signal") as mock_age, \
         patch("devsweep.signals.calculate_version_signal") as mock_version, \
         patch("devsweep.signals.calculate_process_signal") as mock_process, \
         patch("devsweep.signals.calculate_project_signal") as mock_project:
        
        # Mock signals to return high scores
        mock_age.return_value.score = 100
        mock_version.return_value.score = 90
        mock_process.return_value.score = 50
        mock_project.return_value.score = 80
        
        result = score_item(entry, all_entries)
        
        assert result.total_score == 87  # (100*0.4 + 90*0.3 + 50*0.2 + 80*0.1) = 87
        assert result.classification == "critical"


def test_score_item_optional_classification():
    entry = ScanEntry(
        path=Path("/test/file.txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    all_entries = [entry]
    
    with patch("devsweep.signals.calculate_age_signal") as mock_age, \
         patch("devsweep.signals.calculate_version_signal") as mock_version, \
         patch("devsweep.signals.calculate_process_signal") as mock_process, \
         patch("devsweep.signals.calculate_project_signal") as mock_project:
        
        # Mock signals for medium score
        mock_age.return_value.score = 50
        mock_version.return_value.score = 40
        mock_process.return_value.score = 30
        mock_project.return_value.score = 40
        
        result = score_item(entry, all_entries)
        
        total = int(50*0.4 + 40*0.3 + 30*0.2 + 40*0.1)  # 45
        assert result.total_score == total
        assert result.classification == "optional"  # 21-70 range
