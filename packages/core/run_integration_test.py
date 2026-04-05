#!/usr/bin/env python3
"""Simple integration test runner for DevSweep core."""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from tests.integration.test_integration import (
    test_end_to_end_scanning_pipeline,
    test_pipeline_with_empty_directory,
    test_pipeline_error_handling,
)

def run_test(test_func, test_name):
    """Run a single test function."""
    print(f"Running {test_name}...")
    try:
        test_func()
        print(f"✓ {test_name} PASSED")
        return True
    except Exception as e:
        print(f"✗ {test_name} FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all integration tests."""
    print("Running DevSweep Core Integration Tests")
    print("=" * 50)
    
    tests = [
        (test_end_to_end_scanning_pipeline, "End-to-end scanning pipeline"),
        (test_pipeline_with_empty_directory, "Empty directory handling"),
        (test_pipeline_error_handling, "Error handling"),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func, test_name in tests:
        if run_test(test_func, test_name):
            passed += 1
        print()
    
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All integration tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
