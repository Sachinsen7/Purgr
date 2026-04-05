from __future__ import annotations

import os
import shutil
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import AIAdviceRequest, AppSettings, LearnActionRequest, ScanRequest
from .services import scan_manager


def create_app() -> FastAPI:
    app = FastAPI(title="DevSweep Sidecar", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def startup() -> None:
        await scan_manager.startup()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/scan/start")
    async def start_scan(request: ScanRequest) -> dict[str, str]:
        return {"id": await scan_manager.start_scan(request)}

    @app.post("/scan/{scan_id}/stop")
    async def stop_scan(scan_id: str) -> dict[str, str]:
        try:
            await scan_manager.stop_scan(scan_id)
            return {"status": "stopped"}
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.get("/scan/{scan_id}")
    async def get_scan(scan_id: str):
        try:
            return await scan_manager.get_scan_status(scan_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.get("/scan/{scan_id}/results")
    async def get_scan_results(scan_id: str):
        try:
            return await scan_manager.get_scan_results(scan_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.get("/history/scans")
    async def history_scans():
        return await scan_manager.list_history()

    @app.delete("/history/scans")
    async def clear_history() -> dict[str, str]:
        await scan_manager.clear_history()
        return {"status": "cleared"}

    @app.post("/ai/advice")
    async def get_ai_advice(request: AIAdviceRequest):
        return await scan_manager.get_ai_advice(request.filePath)

    @app.post("/ai/learn")
    async def learn_from_user_action(request: LearnActionRequest) -> dict[str, str]:
        await scan_manager.learn_from_user_action(request.filePath, request.action, request.reason)
        return {"status": "ok"}

    @app.get("/settings")
    async def get_settings() -> AppSettings:
        return await scan_manager.load_settings()

    @app.put("/settings")
    async def update_settings(settings: AppSettings) -> AppSettings:
        return await scan_manager.save_settings(settings)

    @app.post("/settings/test-ai")
    async def test_ai_connection() -> dict[str, str]:
        await scan_manager.test_ai_connection()
        return {"status": "ok"}

    @app.get("/system/info")
    async def system_info() -> dict[str, str]:
        return {
            "platform": os.name,
            "arch": os.environ.get("PROCESSOR_ARCHITECTURE", "unknown"),
            "version": app.version,
        }

    @app.post("/files/delete")
    async def delete_files(file_paths: list[str]) -> dict[str, int]:
        deleted_count = 0
        for raw_path in file_paths:
            path = Path(raw_path)
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
                deleted_count += 1
            elif path.exists():
                path.unlink(missing_ok=True)
                deleted_count += 1
        return {"deleted": deleted_count}

    return app


app = create_app()
