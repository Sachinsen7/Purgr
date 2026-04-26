"""
Tests for FastAPI endpoints using TestClient.
This tests all the API endpoints defined in app.py
"""

import pytest
from fastapi.testclient import TestClient
from devsweep.api.app import create_app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    app = create_app()
    return TestClient(app)


class TestHealthEndpoint:
    """Test the /health endpoint."""

    def test_health_check(self, client):
        """Test that health endpoint returns ok status."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestScanEndpoints:
    """Test scan-related endpoints."""

    def test_start_scan(self, client):
        """Test starting a new scan."""
        scan_request = {
            "paths": ["/home/user"],
            "platforms": ["python", "node"],
        }
        response = client.post("/scan/start", json=scan_request)
        assert response.status_code == 200
        result = response.json()
        assert "id" in result
        scan_id = result["id"]
        return scan_id

    def test_get_scan_status(self, client):
        """Test retrieving scan status."""
        # First start a scan
        scan_request = {
            "paths": ["/home/user"],
            "platforms": ["python"],
        }
        start_response = client.post("/scan/start", json=scan_request)
        scan_id = start_response.json()["id"]

        # Then get its status
        response = client.get(f"/scan/{scan_id}")
        assert response.status_code == 200
        result = response.json()
        assert "status" in result

    def test_stop_scan(self, client):
        """Test stopping a scan."""
        # Start a scan first
        scan_request = {
            "paths": ["/home/user"],
            "platforms": ["python"],
        }
        start_response = client.post("/scan/start", json=scan_request)
        scan_id = start_response.json()["id"]

        # Stop it
        response = client.post(f"/scan/{scan_id}/stop")
        assert response.status_code == 200
        assert response.json()["status"] == "stopped"

    def test_get_scan_results(self, client):
        """Test retrieving scan results."""
        # Start a scan
        scan_request = {
            "paths": ["/home/user"],
            "platforms": ["python"],
        }
        start_response = client.post("/scan/start", json=scan_request)
        scan_id = start_response.json()["id"]

        # Get results
        response = client.get(f"/scan/{scan_id}/results")
        assert response.status_code == 200

    def test_stop_nonexistent_scan(self, client):
        """Test stopping a scan that doesn't exist."""
        response = client.post("/scan/nonexistent-id/stop")
        assert response.status_code == 404

    def test_get_nonexistent_scan(self, client):
        """Test getting status of non-existent scan."""
        response = client.get("/scan/nonexistent-id")
        assert response.status_code == 404


class TestHistoryEndpoints:
    """Test scan history endpoints."""

    def test_history_scans(self, client):
        """Test listing scan history."""
        response = client.get("/history/scans")
        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)

    def test_clear_history(self, client):
        """Test clearing scan history."""
        response = client.delete("/history/scans")
        assert response.status_code == 200
        assert response.json()["status"] == "cleared"


class TestAIEndpoints:
    """Test AI-related endpoints."""

    def test_get_ai_advice(self, client):
        """Test getting AI advice for a file path."""
        request_data = {"filePath": "/home/user/.cache/pip"}
        response = client.post("/ai/advice", json=request_data)
        assert response.status_code == 200

    def test_learn_from_user_action(self, client):
        """Test learning from user deletion action."""
        request_data = {
            "filePath": "/home/user/.cache/pip",
            "action": "delete",
            "reason": "old_cache",
        }
        response = client.post("/ai/learn", json=request_data)
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_test_ai_connection(self, client):
        """Test AI connection (Ollama)."""
        response = client.post("/settings/test-ai")
        assert response.status_code == 200


class TestSettingsEndpoints:
    """Test settings endpoints."""

    def test_get_settings(self, client):
        """Test retrieving settings."""
        response = client.get("/settings")
        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, dict)

    def test_update_settings(self, client):
        """Test updating settings."""
        settings = {
            "aiModel": "ollama",
            "enableTelemetry": False,
            "autoDeleteThreshold": 80,
        }
        response = client.put("/settings", json=settings)
        assert response.status_code == 200


class TestSystemEndpoints:
    """Test system endpoints."""

    def test_system_info(self, client):
        """Test retrieving system information."""
        response = client.get("/system/info")
        assert response.status_code == 200
        result = response.json()
        assert "platform" in result
        assert "version" in result


class TestFileOperations:
    """Test file operation endpoints."""

    def test_delete_files(self, client):
        """Test deleting multiple files."""
        file_paths = [
            "/home/user/.cache/pip/cache1",
            "/home/user/.cache/pip/cache2",
        ]
        response = client.post("/files/delete", json=file_paths)
        assert response.status_code == 200
        result = response.json()
        assert "deleted_count" in result or "count" in result
