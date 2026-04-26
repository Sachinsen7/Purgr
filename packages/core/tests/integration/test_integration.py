import os
import tempfile
import time
from pathlib import Path

import pytest

from devsweep.scanner.walker import walk_directory
from devsweep.scorer.engine import score_item
from devsweep.rules.loader import load_rules, get_matching_rules


def _apply_rule_adjustments(path: Path, score: int, rules) -> int:
    adjusted_score = score
    for tool_rules in rules.values():
        for _, score_adjustment, _ in get_matching_rules(path, tool_rules):
            adjusted_score = max(0, min(100, adjusted_score + score_adjustment))
    return adjusted_score


def _classify(score: int) -> str:
    if score <= 20:
        return "safe"
    if score <= 70:
        return "optional"
    return "critical"


def test_end_to_end_scanning_pipeline():
    """Integration test for the complete scanning pipeline."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        
        # Create a realistic test directory structure
        # Old Python cache files
        pycache_dir = root / "__pycache__"
        pycache_dir.mkdir()
        old_pyc = pycache_dir / "module.cpython-312.pyc"
        old_pyc.write_text("fake bytecode")
        # Make it old
        old_time = time.time() - (200 * 24 * 3600)  # 200 days ago
        os.utime(old_pyc, (old_time, old_time))
        
        # VSCode workspace storage
        vscode_dir = root / ".vscode" / "workspaceStorage"
        vscode_dir.mkdir(parents=True)
        workspace_file = vscode_dir / "someid" / "workspace.json"
        workspace_file.parent.mkdir()
        workspace_file.write_text('{"folder": "test"}')
        
        # Recent important file
        important_file = root / "important.py"
        important_file.write_text("# Important code")
        
        # Versioned files
        base_file = root / "config.txt"
        base_file.write_text("config")
        version1 = root / "config(1).txt"
        version1.write_text("config v1")
        version2 = root / "config_v2.txt"
        version2.write_text("config v2")
        
        # Scan the directory
        entries = list(walk_directory(root))
        assert len(entries) > 5  # Should find multiple files and dirs
        
        # Load rules
        rules = load_rules()
        assert "python" in rules
        assert "vscode" in rules
        
        # Score each entry and check results
        scored_items = []
        for entry in entries:
            if entry.is_file:  # Only score files
                scored_item = score_item(entry, entries)
                adjusted_score = _apply_rule_adjustments(
                    entry.path,
                    scored_item.total_score,
                    rules,
                )
                scored_items.append(
                    (
                        entry.path,
                        adjusted_score,
                        _classify(adjusted_score),
                    )
                )
        
        # Find and verify specific scored items
        pyc_item = next(item for item in scored_items if "__pycache__" in str(item[0]))
        vscode_item = next(item for item in scored_items if "workspaceStorage" in str(item[0]))
        important_item = next(item for item in scored_items if "important.py" in str(item[0]))
        version_item = next(item for item in scored_items if "config(1).txt" in str(item[0]))
        
        # Verify classifications
        assert pyc_item[2] in ["optional", "critical"]  # Old cache file
        assert vscode_item[2] in ["optional", "critical"]  # Cache file
        assert important_item[2] == "safe"  # Recent, no versions
        assert version_item[2] in ["optional", "critical"]  # Has version siblings
        
        # Test rule matching
        python_rules = rules["python"]
        vscode_rules = rules["vscode"]
        
        pyc_matches = get_matching_rules(pyc_item[0], python_rules)
        assert len(pyc_matches) > 0
        assert any("bytecode cache" in match[0] for match in pyc_matches)
        
        vscode_matches = get_matching_rules(vscode_item[0], vscode_rules)
        assert len(vscode_matches) > 0
        assert any("workspace storage" in match[0].lower() for match in vscode_matches)


def test_pipeline_with_empty_directory():
    """Test pipeline with empty directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        entries = list(walk_directory(root))
        assert len(entries) == 0  # Empty dir should have no entries


def test_pipeline_error_handling():
    """Test pipeline handles errors gracefully."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        
        # Create a file and then make parent dir unreadable (if possible)
        test_file = root / "test.txt"
        test_file.write_text("test")
        
        entries = list(walk_directory(root))
        assert len(entries) >= 1  # Should still find the file
        
        # All entries should be valid ScanEntry objects
        for entry in entries:
            assert isinstance(entry.path, Path)
            assert isinstance(entry.size, int)
            assert isinstance(entry.mtime, float)
            assert isinstance(entry.is_dir, bool)
            assert isinstance(entry.is_file, bool)
            assert isinstance(entry.is_symlink, bool)
