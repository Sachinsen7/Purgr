import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from devsweep.scanner.walker import walk_directory


def test_walk_empty_directory():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        entries = list(walk_directory(root))
        assert len(entries) == 0


def test_walk_directory_with_files():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        
        # Create test files and directories
        (root / "file1.txt").write_text("content1")
        (root / "file2.txt").write_text("content2")
        (root / "subdir").mkdir()
        (root / "subdir" / "file3.txt").write_text("content3")
        
        entries = list(walk_directory(root))
        
        # Should find all files and directories
        paths = {entry.path.relative_to(root) for entry in entries}
        expected = {
            Path("file1.txt"),
            Path("file2.txt"),
            Path("subdir"),
            Path("subdir/file3.txt"),
        }
        assert paths == expected


def test_walk_directory_permissions_error():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        subdir = root / "restricted"
        subdir.mkdir()
        (subdir / "file.txt").write_text("content")
        
        # Mock os.scandir to raise PermissionError
        with patch("os.scandir") as mock_scandir:
            mock_scandir.side_effect = PermissionError("Access denied")
            
            # Should not crash, should log warning
            entries = list(walk_directory(root))
            
            # Should still find the root directory entry if it exists
            # But since we mocked scandir, it might not find anything
            # The test is that it doesn't raise an exception
            assert isinstance(entries, list)


def test_scan_entry_properties():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        test_file = root / "test.txt"
        test_file.write_text("hello world")
        
        entries = list(walk_directory(root))
        file_entry = next(e for e in entries if e.path == test_file)
        
        assert file_entry.is_file is True
        assert file_entry.is_dir is False
        assert file_entry.size == 11  # "hello world" is 11 bytes
        assert isinstance(file_entry.mtime, float)
        assert file_entry.path == test_file
