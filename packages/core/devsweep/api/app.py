from __future__ import annotations

import asyncio
import ctypes
import os
import shutil
from ctypes import wintypes
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    AIAdviceRequest,
    AppSettings,
    AssistantQueryRequest,
    DeleteFilesRequest,
    LearnActionRequest,
    ScanRequest,
)
from .services import scan_manager


def _install_windows_disconnect_filter() -> None:
    if os.name != "nt":
        return

    loop = asyncio.get_running_loop()
    previous_handler = loop.get_exception_handler()

    def handle_exception(loop, context) -> None:
        exception = context.get("exception")
        if (
            isinstance(exception, ConnectionResetError)
            and getattr(exception, "winerror", None) == 10054
        ):
            return
        handle = str(context.get("handle", ""))
        if (
            isinstance(exception, AssertionError)
            and "BaseProactorEventLoop._start_serving" in handle
        ):
            return
        if previous_handler is not None:
            previous_handler(loop, context)
            return
        loop.default_exception_handler(context)

    loop.set_exception_handler(handle_exception)


def _send_to_recycle_bin(path: Path) -> None:
    if os.name != "nt":
        raise OSError("Recycle Bin cleanup is only supported on Windows in v1.")

    class SHFILEOPSTRUCTW(ctypes.Structure):
        _fields_ = [
            ("hwnd", wintypes.HWND),
            ("wFunc", wintypes.UINT),
            ("pFrom", wintypes.LPCWSTR),
            ("pTo", wintypes.LPCWSTR),
            ("fFlags", ctypes.c_ushort),
            ("fAnyOperationsAborted", wintypes.BOOL),
            ("hNameMappings", wintypes.LPVOID),
            ("lpszProgressTitle", wintypes.LPCWSTR),
        ]

    shell32 = ctypes.windll.shell32
    op = SHFILEOPSTRUCTW()
    op.wFunc = 3
    op.pFrom = f"{path}\0\0"
    op.fFlags = 0x0040 | 0x0010 | 0x0400
    result = shell32.SHFileOperationW(ctypes.byref(op))
    if result != 0:
        raise OSError(f"Recycle Bin operation failed for {path}")


def create_app() -> FastAPI:
    app = FastAPI(title="DevSweep Sidecar", version="0.2.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def startup() -> None:
        _install_windows_disconnect_filter()
        await scan_manager.startup()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/scan/start")
    async def start_scan(request: ScanRequest) -> dict[str, str]:
        try:
            return {"id": await scan_manager.start_scan(request)}
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

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

    @app.get("/history/scans/{scan_id}")
    async def history_scan(scan_id: str):
        try:
            return await scan_manager.get_history_scan(scan_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

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
        try:
            return await asyncio.wait_for(scan_manager.load_settings(), timeout=2)
        except Exception:
            return AppSettings()

    @app.put("/settings")
    async def update_settings(settings: AppSettings) -> AppSettings:
        return await scan_manager.save_settings(settings)

    @app.post("/settings/test-ai")
    async def test_ai_connection() -> dict[str, str]:
        try:
            await scan_manager.test_ai_connection()
            return {"status": "ok"}
        except Exception as error:
            raise HTTPException(
                status_code=503,
                detail=f"Could not reach the local AI server: {error}",
            ) from error

    @app.get("/system/info")
    async def system_info() -> dict[str, str]:
        return {
            "platform": os.name,
            "arch": os.environ.get("PROCESSOR_ARCHITECTURE", "unknown"),
            "version": app.version,
        }

    @app.get("/system/drives")
    async def system_drives():
        return await scan_manager.get_system_drives()

    @app.get("/system/overview")
    async def system_overview():
        return await scan_manager.get_system_overview()

    @app.post("/assistant/query")
    async def assistant_query(request: AssistantQueryRequest):
        try:
            return await scan_manager.query_assistant(request.query, request.sessionId, request.limit)
        except KeyError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.post("/files/delete")
    async def delete_files(request: DeleteFilesRequest):
        deleted_count = 0
        for raw_path in request.filePaths:
            path = Path(raw_path)
            if not path.exists():
                continue
            if request.mode == "recycle":
                _send_to_recycle_bin(path)
                deleted_count += 1
                continue
            if path.is_dir():
                shutil.rmtree(path, ignore_errors=True)
                deleted_count += 1
            else:
                path.unlink(missing_ok=True)
                deleted_count += 1
        if deleted_count > 0:
            await scan_manager.record_deleted_paths(request.filePaths, request.mode)
        return {"deleted": deleted_count, "mode": request.mode}

    return app


app = create_app()
