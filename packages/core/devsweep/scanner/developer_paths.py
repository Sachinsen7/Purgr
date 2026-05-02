"""
Developer-focused scan path detection.

Automatically identifies relevant developer directories to scan
without requiring manual path selection from users.
"""

from __future__ import annotations

import os
import platform
from pathlib import Path

import structlog

logger = structlog.get_logger()

# Expanded environment variable paths for developer tools
DEVELOPER_PATHS_WINDOWS = [
    # VS Code
    "%APPDATA%\\Code\\CachedExtensionVSIXs",
    "%APPDATA%\\Code\\logs",
    "%APPDATA%\\Code\\User\\workspaceStorage",
    "%APPDATA%\\Code\\User\\globalStorage",
    
    # npm / Node.js
    "%APPDATA%\\npm-cache",
    "%LOCALAPPDATA%\\npm-cache",
    "%USERPROFILE%\\node_modules",  # Legacy projects
    
    # pip / Python
    "%LOCALAPPDATA%\\pip\\Cache",
    "%APPDATA%\\pip\\Cache",
    "%USERPROFILE%\\.pip\\cache",
    "%USERPROFILE%\\.cache\\pip",
    
    # Gradle & Android SDK
    "%LOCALAPPDATA%\\Android\\Sdk\\system-images",
    "%LOCALAPPDATA%\\Android\\Sdk\\platforms",
    "%LOCALAPPDATA%\\Android\\Sdk\\build-tools",
    "%USERPROFILE%\\.gradle\\caches",
    "%USERPROFILE%\\.gradle\\wrapper",
    
    # Rust / Cargo
    "%USERPROFILE%\\.cargo\\registry\\cache",
    "%USERPROFILE%\\.cargo\\git\\checkouts",
    
    # General caches & temp
    "%USERPROFILE%\\.cache",
    "%TEMP%",
    "%LOCALAPPDATA%\\Temp",
]

DEVELOPER_PATHS_MACOS = [
    # VS Code
    "~/Library/Application Support/Code/CachedExtensionVSIXs",
    "~/Library/Application Support/Code/User/workspaceStorage",
    
    # npm / Node.js
    "~/.npm",
    "~/.cache/npm",
    
    # pip / Python
    "~/Library/Caches/pip",
    "~/.cache/pip",
    
    # Gradle & Android SDK
    "~/.gradle/caches",
    "~/Library/Android/sdk/system-images",
    
    # Rust / Cargo
    "~/.cargo/registry/cache",
    
    # General caches
    "~/.cache",
    "/var/tmp",
    "/tmp",
]

DEVELOPER_PATHS_LINUX = [
    # VS Code
    "~/.config/Code/CachedExtensionVSIXs",
    "~/.config/Code/User/workspaceStorage",
    
    # npm / Node.js
    "~/.npm",
    "~/.cache/npm",
    
    # pip / Python
    "~/.cache/pip",
    
    # Gradle & Android SDK
    "~/.gradle/caches",
    "~/.android/avd",
    
    # Rust / Cargo
    "~/.cargo/registry/cache",
    
    # General caches & temp
    "~/.cache",
    "/tmp",
]


def get_developer_scan_paths() -> list[Path]:
    """
    Get list of developer-relevant directories to scan.
    
    Expands environment variables and filters out paths that don't exist.
    Returns empty list if no developer paths are found.
    """
    os_name = platform.system()
    
    if os_name == "Windows":
        template_paths = DEVELOPER_PATHS_WINDOWS
    elif os_name == "Darwin":
        template_paths = DEVELOPER_PATHS_MACOS
    else:
        template_paths = DEVELOPER_PATHS_LINUX
    
    valid_paths: list[Path] = []
    
    for template_path in template_paths:
        try:
            # Expand environment variables and user home
            expanded_path = os.path.expandvars(os.path.expanduser(template_path))
            path_obj = Path(expanded_path)
            
            if path_obj.exists():
                valid_paths.append(path_obj)
                logger.debug("Found developer path", path=str(path_obj))
            else:
                logger.debug("Developer path not found (OK)", path=expanded_path)
        except Exception as error:
            logger.debug("Error resolving developer path", path=template_path, error=str(error))
            continue
    
    if not valid_paths:
        logger.warning("No developer paths found - falling back to home directory")
        valid_paths = [Path.home()]
    
    return valid_paths


def get_dead_project_search_locations() -> list[Path]:
    """
    Get directories where dead projects are likely to be found.
    
    These are common locations for storing development projects.
    """
    locations: list[Path] = []
    home = Path.home()
    
    # Standard locations
    standard_dirs = [
        home / "Desktop",
        home / "Documents",
        home / "Downloads",
        home / "Projects",
        home / "code",
        home / "dev",
        home / "workspace",
    ]
    
    for directory in standard_dirs:
        if directory.exists():
            locations.append(directory)
    
    # Search first level of each drive (Windows)
    if platform.system() == "Windows":
        import string
        for drive_letter in string.ascii_uppercase:
            drive_path = Path(f"{drive_letter}:")
            if drive_path.exists():
                for candidate in ["Projects", "code", "dev", "workspace"]:
                    candidate_path = drive_path / candidate
                    if candidate_path.exists():
                        locations.append(candidate_path)
    
    return locations
