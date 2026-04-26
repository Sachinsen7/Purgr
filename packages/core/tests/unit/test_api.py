from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from devsweep.api.app import create_app
from devsweep.api.schemas import (
    AppSettings,
    AssistantQueryResponse,
    DriveInfoResponse,
    ScanDetailsResponse,
    ScanSessionResponse,
    ScanSummaryResponse,
    SystemOverviewResponse,
)
from devsweep.api.services import scan_manager


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_start_scan(client, monkeypatch):
    monkeypatch.setattr(scan_manager, "start_scan", AsyncMock(return_value="42"))
    response = client.post("/scan/start", json={})
    assert response.status_code == 200
    assert response.json() == {"id": "42"}


def test_get_scan_status(client, monkeypatch):
    session = ScanSessionResponse(
        id="42",
        rootPaths=["C:\\"],
        status="scanning",
        phase="scanning",
        progress=15.5,
        discoveredFiles=10,
        processedFiles=8,
        bytesScanned=4096,
        summary=ScanSummaryResponse(),
    )
    monkeypatch.setattr(scan_manager, "get_scan_status", AsyncMock(return_value=session))
    response = client.get("/scan/42")
    assert response.status_code == 200
    assert response.json()["id"] == "42"
    assert response.json()["phase"] == "scanning"


def test_get_scan_results(client, monkeypatch):
    details = ScanDetailsResponse(
        session=ScanSessionResponse(
            id="42",
            rootPaths=["C:\\"],
            status="completed",
            phase="completed",
            progress=100,
            discoveredFiles=2,
            processedFiles=2,
            bytesScanned=2048,
            summary=ScanSummaryResponse(totalFiles=2, totalSize=2048),
        ),
        results=[],
    )
    monkeypatch.setattr(scan_manager, "get_scan_results", AsyncMock(return_value=details))
    response = client.get("/scan/42/results")
    assert response.status_code == 200
    assert response.json()["session"]["status"] == "completed"


def test_history_endpoints(client, monkeypatch):
    session = ScanSessionResponse(
        id="42",
        rootPaths=["C:\\"],
        status="completed",
        phase="completed",
        progress=100,
        discoveredFiles=2,
        processedFiles=2,
        bytesScanned=2048,
        summary=ScanSummaryResponse(totalFiles=2, totalSize=2048),
    )
    details = ScanDetailsResponse(session=session, results=[])

    monkeypatch.setattr(scan_manager, "list_history", AsyncMock(return_value=[session]))
    monkeypatch.setattr(scan_manager, "get_history_scan", AsyncMock(return_value=details))
    monkeypatch.setattr(scan_manager, "clear_history", AsyncMock())

    response = client.get("/history/scans")
    assert response.status_code == 200
    assert response.json()[0]["id"] == "42"

    response = client.get("/history/scans/42")
    assert response.status_code == 200
    assert response.json()["session"]["id"] == "42"

    response = client.delete("/history/scans")
    assert response.status_code == 200
    assert response.json()["status"] == "cleared"


def test_settings_endpoints(client, monkeypatch):
    settings = AppSettings()
    monkeypatch.setattr(scan_manager, "load_settings", AsyncMock(return_value=settings))
    monkeypatch.setattr(scan_manager, "save_settings", AsyncMock(return_value=settings))

    response = client.get("/settings")
    assert response.status_code == 200
    assert response.json()["appearance"]["theme"] == "dark"

    response = client.put("/settings", json=settings.model_dump(mode="json"))
    assert response.status_code == 200
    assert response.json()["appearance"]["theme"] == "dark"


def test_system_endpoints(client, monkeypatch):
    overview = SystemOverviewResponse(
        drives=[
            DriveInfoResponse(
                id="C:\\",
                path="C:\\",
                label="C:",
                fileSystem="NTFS",
                totalBytes=100,
                freeBytes=20,
                usedBytes=80,
            )
        ],
        historyCount=1,
    )
    monkeypatch.setattr(scan_manager, "get_system_drives", AsyncMock(return_value=overview.drives))
    monkeypatch.setattr(scan_manager, "get_system_overview", AsyncMock(return_value=overview))

    response = client.get("/system/drives")
    assert response.status_code == 200
    assert response.json()[0]["path"] == "C:\\"

    response = client.get("/system/overview")
    assert response.status_code == 200
    assert response.json()["historyCount"] == 1


def test_assistant_query(client, monkeypatch):
    payload = AssistantQueryResponse(
        query="sdkmanager",
        answer="Found 1 relevant file.",
        matches=[],
    )
    monkeypatch.setattr(scan_manager, "query_assistant", AsyncMock(return_value=payload))
    response = client.post(
        "/assistant/query",
        json={"query": "sdkmanager", "sessionId": "42", "limit": 5},
    )
    assert response.status_code == 200
    assert response.json()["query"] == "sdkmanager"


def test_ai_endpoints(client, monkeypatch):
    monkeypatch.setattr(
        scan_manager,
        "get_ai_advice",
        AsyncMock(
            return_value={
                "recommendation": "review",
                "confidence": 0.5,
                "explanation": "Check it.",
                "reasoningSignals": [],
                "similarPatterns": [],
            }
        ),
    )
    monkeypatch.setattr(scan_manager, "learn_from_user_action", AsyncMock())
    monkeypatch.setattr(scan_manager, "test_ai_connection", AsyncMock())

    response = client.post("/ai/advice", json={"filePath": "C:\\temp.txt"})
    assert response.status_code == 200
    assert response.json()["recommendation"] == "review"

    response = client.post(
        "/ai/learn",
        json={"filePath": "C:\\temp.txt", "action": "keep", "reason": "needed"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    response = client.post("/settings/test-ai")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
