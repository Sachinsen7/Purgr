#!/usr/bin/env python3
"""Integration test for DevSweep core pipeline."""

import os
import tempfile
import time
from pathlib import Path

from devsweep.scanner.walker import walk_directory
from devsweep.scorer.engine import score_item
from devsweep.rules.loader import load_rules, get_matching_rules


def test_end_to_end_scanning_pipeline():
    """Integration test for the complete scanning pipeline."""
    print("Testing end-to-end scanning pipeline...")
    
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
        print(f"Found {len(entries)} entries")
        assert len(entries) > 5  # Should find multiple files and dirs
        
        # Load rules
        rules = load_rules()
        print(f"Loaded rules for tools: {list(rules.keys())}")
        assert "python" in rules
        assert "vscode" in rules
        
        # Score each entry and check results
        scored_items = []
        for entry in entries:
            if entry.is_file:  # Only score files
                scored_item = score_item(entry, entries)
                scored_items.append(scored_item)
        
        print(f"Scored {len(scored_items)} files")
        
        # Find and verify specific scored items
        pyc_item = next((item for item in scored_items if "__pycache__" in str(item.entry.path)), None)
        vscode_item = next((item for item in scored_items if "workspaceStorage" in str(item.entry.path)), None)
        important_item = next((item for item in scored_items if "important.py" in str(item.entry.path)), None)
        version_item = next((item for item in scored_items if "config(1).txt" in str(item.entry.path)), None)
        
        if pyc_item:
            print(f"Python cache file classification: {pyc_item.classification} (score: {pyc_item.total_score})")
            assert pyc_item.classification in ["optional", "critical"]  # Old cache file
        
        if vscode_item:
            print(f"VSCode workspace file classification: {vscode_item.classification} (score: {vscode_item.total_score})")
            assert vscode_item.classification in ["optional", "critical"]  # Cache file
        
        if important_item:
            print(f"Important file classification: {important_item.classification} (score: {important_item.total_score})")
            assert important_item.classification == "safe"  # Recent, no versions
        
        if version_item:
            print(f"Versioned file classification: {version_item.classification} (score: {version_item.total_score})")
            assert version_item.classification in ["optional", "critical"]  # Has version siblings
        
        # Test rule matching
        python_rules = rules["python"]
        vscode_rules = rules["vscode"]
        
        if pyc_item:
            pyc_matches = get_matching_rules(pyc_item.entry.path, python_rules)
            print(f"Python rules matched for pyc file: {len(pyc_matches)}")
            assert len(pyc_matches) > 0
            assert any("bytecode cache" in match[0] for match in pyc_matches)
        
        if vscode_item:
            vscode_matches = get_matching_rules(vscode_item.entry.path, vscode_rules)
            print(f"VSCode rules matched for workspace file: {len(vscode_matches)}")
            assert len(vscode_matches) > 0
            assert any("workspace storage" in match[0].lower() for match in vscode_matches)
    
    print("✓ End-to-end pipeline test passed")


def test_pipeline_with_empty_directory():
    """Test pipeline with empty directory."""
    print("Testing empty directory handling...")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        entries = list(walk_directory(root))
        assert len(entries) == 0  # Empty dir should have no entries
    
    print("✓ Empty directory test passed")


def main():
    """Run all integration tests."""
    print("Running DevSweep Core Integration Tests")
    print("=" * 50)
    
    tests = [
        test_end_to_end_scanning_pipeline,
        test_pipeline_with_empty_directory,
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            test_func()
            passed += 1
            print()
        except Exception as e:
            print(f"✗ {test_func.__name__} FAILED: {e}")
            import traceback
            traceback.print_exc()
            print()
    
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All integration tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
