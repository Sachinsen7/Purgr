import time
from pathlib import Path
from unittest.mock import patch, mock_open

import pytest

from devsweep.models import ScanEntry, SignalResult
from devsweep.signals import (
    calculate_age_signal,
    calculate_version_signal,
    calculate_process_signal,
    calculate_project_signal,
)


def test_calculate_age_signal_directory():
    entry = ScanEntry(
        path=Path("/test/dir"),
        size=0,
        mtime=time.time(),
        is_dir=True,
        is_file=False,
        is_symlink=False,
    )
    result = calculate_age_signal(entry)
    assert result.score == 0
    assert "Directories are not scored" in result.reason


def test_calculate_age_signal_recent_file():
    recent_time = time.time() - (24 * 3600)  # 1 day ago
    entry = ScanEntry(
        path=Path("/test/file.txt"),
        size=100,
        mtime=recent_time,
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    result = calculate_age_signal(entry)
    assert result.score < 50  # Less than 50% of a year
    assert "days old" in result.reason


def test_calculate_age_signal_old_file():
    old_time = time.time() - (365 * 24 * 3600)  # 1 year ago
    entry = ScanEntry(
        path=Path("/test/file.txt"),
        size=100,
        mtime=old_time,
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    result = calculate_age_signal(entry)
    assert result.score == 100
    assert "days old" in result.reason


def test_calculate_version_signal_no_siblings():
    entry = ScanEntry(
        path=Path("/test/file.txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    all_entries = [entry]
    result = calculate_version_signal(entry, all_entries)
    assert result.score == 0
    assert "No versioned siblings" in result.reason


def test_calculate_version_signal_with_siblings():
    entry = ScanEntry(
        path=Path("/test/file.txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    sibling1 = ScanEntry(
        path=Path("/test/file(1).txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    all_entries = [entry, sibling1]
    result = calculate_version_signal(entry, all_entries)
    assert result.score == 30
    assert "One versioned sibling" in result.reason


def test_calculate_version_signal_for_versioned_entry():
    entry = ScanEntry(
        path=Path("/test/config(1).txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    sibling1 = ScanEntry(
        path=Path("/test/config.txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    sibling2 = ScanEntry(
        path=Path("/test/config_v2.txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )

    all_entries = [entry, sibling1, sibling2]
    result = calculate_version_signal(entry, all_entries)

    assert result.score == 60
    assert "versioned siblings" in result.reason


def test_calculate_process_signal_directory():
    entry = ScanEntry(
        path=Path("/test/dir"),
        size=0,
        mtime=time.time(),
        is_dir=True,
        is_file=False,
        is_symlink=False,
    )
    result = calculate_process_signal(entry)
    assert result.score == 0
    assert "Directories are not checked" in result.reason


def test_calculate_process_signal_file_not_open():
    entry = ScanEntry(
        path=Path("/test/file.txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    with patch("psutil.process_iter") as mock_iter:
        mock_iter.return_value = []
        result = calculate_process_signal(entry)
        assert result.score == 50
        assert "not currently open" in result.reason


def test_calculate_project_signal_directory():
    entry = ScanEntry(
        path=Path("/test/dir/file.txt"),
        size=100,
        mtime=time.time(),
        is_dir=True,
        is_file=False,
        is_symlink=False,
    )
    result = calculate_project_signal(entry)
    assert result.score == 0
    assert "Directories are not scored" in result.reason


def test_calculate_project_signal_git_repo():
    entry = ScanEntry(
        path=Path("/project/src/file.txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    
    with patch("pathlib.Path.exists") as mock_exists:
        mock_exists.return_value = True
        result = calculate_project_signal(entry)
        assert result.score == 10
        assert "active Git repository" in result.reason


def test_calculate_project_signal_no_activity():
    entry = ScanEntry(
        path=Path("/isolated/file.txt"),
        size=100,
        mtime=time.time(),
        is_dir=False,
        is_file=True,
        is_symlink=False,
    )
    
    with patch("pathlib.Path.exists") as mock_exists, \
         patch("os.scandir") as mock_scandir:
        mock_exists.return_value = False
        mock_scandir.return_value = []
        result = calculate_project_signal(entry)
        assert result.score == 80
        assert "not in an active project" in result.reason
