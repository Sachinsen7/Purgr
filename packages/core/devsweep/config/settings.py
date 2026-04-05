from pathlib import Path
from typing import Optional


class Settings:
    """Simple settings class."""

    def __init__(self):
        self.database_path = None  # Will use default user data directory
        self.ollama_base_url = "http://localhost:11434"
        self.ai_provider = "ollama"
        self.ai_model = "llama3.2"
        self.log_level = "INFO"


def get_settings():
    """Get application settings."""
    return Settings()
