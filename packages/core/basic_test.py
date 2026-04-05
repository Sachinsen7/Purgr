#!/usr/bin/env python3
"""Basic test without dependencies."""

import os
import tempfile
import time
from pathlib import Path

def test_basic():
    print("Testing basic Python functionality...")
    
    # Test path operations
    test_path = Path("/test/file.txt")
    print(f"Path created: {test_path}")
    
    # Test temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "test.txt"
        test_file.write_text("hello")
        content = test_file.read_text()
        assert content == "hello"
        print("File I/O works")
    
    # Test time operations
    current_time = time.time()
    old_time = current_time - (365 * 24 * 3600)  # 1 year ago
    assert old_time < current_time
    print("Time operations work")
    
    # Test os operations
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = Path(tmpdir) / "test.txt"
        test_file.write_text("test")
        stat = os.stat(test_file)
        assert stat.st_size > 0
        print("OS stat works")
    
    print("Basic functionality test PASSED!")

if __name__ == "__main__":
    test_basic()
