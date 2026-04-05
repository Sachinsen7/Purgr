from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


class Settings:
    """Application settings resolved from the local environment."""

    def __init__(self) -> None:
        self.user_data_dir = self._resolve_user_data_dir()
        try:
            self.user_data_dir.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            self.user_data_dir = Path.cwd() / ".devsweep-data"
            self.user_data_dir.mkdir(parents=True, exist_ok=True)

        self.database_path = str(self.user_data_dir / "devsweep.db")
        self.settings_path = str(self.user_data_dir / "settings.json")
        self.ollama_base_url = os.environ.get("DEVSWEEP_OLLAMA_BASE_URL", "http://localhost:11434")
        self.ai_provider = "ollama"
        self.ai_model = os.environ.get("DEVSWEEP_AI_MODEL", "llama3.2")
        self.api_host = os.environ.get("DEVSWEEP_API_HOST", "127.0.0.1")
        self.api_port = int(os.environ.get("DEVSWEEP_API_PORT", "9231"))
        self.log_level = os.environ.get("DEVSWEEP_LOG_LEVEL", "INFO")

    @staticmethod
    def _resolve_user_data_dir() -> Path:
        if os.name == "nt":
            base_dir = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
            return base_dir / "DevSweep"

        xdg_data_home = os.environ.get("XDG_DATA_HOME")
        if xdg_data_home:
            return Path(xdg_data_home) / "devsweep"

        return Path.home() / ".local" / "share" / "devsweep"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
