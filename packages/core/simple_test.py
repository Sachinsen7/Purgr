#!/usr/bin/env python3
"""Simple test to verify basic functionality."""

import os
import tempfile
import time
from pathlib import Path

# Test basic imports
print("Testing imports...")
try:
    from devsweep.models import ScanEntry, SignalResult, ScoredItem
    print("✓ Models imported successfully")
except ImportError as e:
    print(f"✗ Models import failed: {e}")
    exit(1)

try:
    from devsweep.scanner.platforms import ToolName, get_tool_paths
    print("✓ Platforms imported successfully")
except ImportError as e:
    print(f"✗ Platforms import failed: {e}")
    exit(1)

try:
    from devsweep.rules.loader import load_rules
    print("✓ Rules imported successfully")
except ImportError as e:
    print(f"✗ Rules import failed: {e}")
    exit(1)

# Test basic functionality
print("\nTesting basic functionality...")

# Test platforms
paths = get_tool_paths(ToolName.PYTHON)
print(f"Python tool paths found: {len(paths)} paths")

# Test rules loading
rules = load_rules()
print(f"Rules loaded for tools: {list(rules.keys())}")

# Test models
entry = ScanEntry(
    path=Path("/test/file.txt"),
    size=100,
    mtime=time.time(),
    is_dir=False,
    is_file=True,
    is_symlink=False,
)
print(f"ScanEntry created: {entry.path}")

signal = SignalResult(score=50, reason="test")
print(f"SignalResult created: score={signal.score}")

item = ScoredItem(
    entry=entry,
    total_score=50,
    classification="optional",
    signals={"test": signal},
)
print(f"ScoredItem created: classification={item.classification}")

print("\n🎉 Basic functionality test passed!")
