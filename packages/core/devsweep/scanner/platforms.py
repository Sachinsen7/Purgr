import os
import platform
from enum import StrEnum
from pathlib import Path
from typing import List


class ToolName(StrEnum):
    VSCODE = "vscode"
    ANDROID = "android"
    PYTHON = "python"
    NODE = "node"


def get_tool_paths(tool: ToolName) -> List[Path]:
    system = platform.system()
    home = Path.home()

    if system == "Windows":
        appdata = Path(os.environ.get("APPDATA", home / "AppData" / "Roaming"))
        local_appdata = Path(os.environ.get("LOCALAPPDATA", home / "AppData" / "Local"))

        if tool == ToolName.VSCODE:
            return [
                appdata / "Code" / "User" / "workspaceStorage",
                appdata / "Code" / "CachedData",
                local_appdata / "Microsoft" / "VS Code" / "Cache",
            ]
        elif tool == ToolName.ANDROID:
            return [
                appdata / "JetBrains",
                local_appdata / "Google",
            ]
        elif tool == ToolName.PYTHON:
            return [
                local_appdata / "pip" / "Cache",
                home / ".cache" / "pip",
            ]
        elif tool == ToolName.NODE:
            return [
                appdata / "npm-cache",
                local_appdata / "npm-cache",
                home / ".npm" / "_cacache",
            ]

    elif system == "Darwin":  # macOS
        if tool == ToolName.VSCODE:
            return [
                home
                / "Library"
                / "Application Support"
                / "Code"
                / "User"
                / "workspaceStorage",
                home / "Library" / "Caches" / "com.microsoft.VSCode",
            ]
        elif tool == ToolName.ANDROID:
            return [
                home / "Library" / "Caches" / "JetBrains",
                home / "Library" / "Logs" / "JetBrains",
            ]
        elif tool == ToolName.PYTHON:
            return [
                home / "Library" / "Caches" / "pip",
                home / ".cache" / "pip",
            ]
        elif tool == ToolName.NODE:
            return [
                home / ".npm" / "_cacache",
            ]

    elif system == "Linux":
        if tool == ToolName.VSCODE:
            return [
                home / ".vscode" / "extensions",
                home / ".cache" / "vscode",
                home / ".config" / "Code" / "User" / "workspaceStorage",
            ]
        elif tool == ToolName.ANDROID:
            return [
                home / ".cache" / "JetBrains",
                home / ".local" / "share" / "JetBrains",
            ]
        elif tool == ToolName.PYTHON:
            return [
                home / ".cache" / "pip",
            ]
        elif tool == ToolName.NODE:
            return [
                home / ".npm" / "_cacache",
                home / ".cache" / "npm",
            ]

    return []
