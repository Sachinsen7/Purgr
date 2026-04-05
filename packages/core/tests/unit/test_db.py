from datetime import datetime
from pathlib import Path

from devsweep.db.models import ScanSession, ScanResult, DeletionAudit


def test_scan_session_model():
    """Test ScanSession model creation and validation."""
    session = ScanSession(
        root_path="/test/path",
        total_files_scanned=100,
        total_size_scanned=1024000,
        scan_duration_seconds=45.5,
    )
    
    assert session.root_path == "/test/path"
    assert session.total_files_scanned == 100
    assert session.total_size_scanned == 1024000
    assert session.scan_duration_seconds == 45.5
    assert isinstance(session.created_at, datetime)
    assert session.id is None  # Not set yet


def test_scan_result_model():
    """Test ScanResult model creation and validation."""
    result = ScanResult(
        session_id=1,
        file_path="/test/file.txt",
        file_size=1024,
        file_mtime=1640995200.0,  # 2022-01-01 00:00:00 UTC
        is_directory=False,
        total_score=75,
        classification="critical",
        age_score=80,
        age_reason="File is very old",
        version_score=60,
        version_reason="Has version siblings",
        process_score=50,
        process_reason="Not currently open",
        project_score=90,
        project_reason="Not in active project",
        rule_matches='[{"description": "Test rule", "score_adjustment": 10}]',
        marked_for_deletion=True,
        deletion_reason="Old cache file",
    )
    
    assert result.session_id == 1
    assert result.file_path == "/test/file.txt"
    assert result.file_size == 1024
    assert result.is_directory is False
    assert result.total_score == 75
    assert result.classification == "critical"
    assert result.marked_for_deletion is True
    assert result.deletion_reason == "Old cache file"


def test_deletion_audit_model():
    """Test DeletionAudit model creation and validation."""
    audit = DeletionAudit(
        result_id=1,
        action="marked",
        reason="User marked for deletion",
        file_existed=True,
        file_size_at_action=1024,
    )
    
    assert audit.result_id == 1
    assert audit.action == "marked"
    assert audit.reason == "User marked for deletion"
    assert audit.file_existed is True
    assert audit.file_size_at_action == 1024
    assert isinstance(audit.timestamp, datetime)


def test_model_relationships():
    """Test that model relationships are properly defined."""
    # Create a session
    session = ScanSession(root_path="/test")
    
    # Create results for the session
    result1 = ScanResult(
        session_id=1,  # Would be set by SQLAlchemy
        file_path="/test/file1.txt",
        file_size=100,
        file_mtime=1640995200.0,
        is_directory=False,
        total_score=50,
        classification="optional",
        age_score=50, age_reason="test",
        version_score=50, version_reason="test",
        process_score=50, process_reason="test",
        project_score=50, project_reason="test",
    )
    
    result2 = ScanResult(
        session_id=1,
        file_path="/test/file2.txt",
        file_size=200,
        file_mtime=1640995200.0,
        is_directory=False,
        total_score=60,
        classification="critical",
        age_score=60, age_reason="test",
        version_score=60, version_reason="test",
        process_score=60, process_reason="test",
        project_score=60, project_reason="test",
    )
    
    # Test that we can access the relationships (in real usage, SQLAlchemy would populate these)
    assert hasattr(session, 'results')
    assert hasattr(result1, 'session')
    assert hasattr(result1, 'audit_logs')
    assert hasattr(result2, 'audit_logs')
