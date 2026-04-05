from pathlib import Path
from typing import Optional

from dynaconf import Dynaconf


def get_settings():
    """Get application settings using Dynaconf."""
    return Dynaconf(
        settings_files=['settings.toml', '.secrets.toml'],
        environments=True,
        envvar_prefix='DEVSWEEP',
        defaults={
            'database_path': None,  # Will use default user data directory
            'ollama_base_url': 'http://localhost:11434',
            'ai_provider': 'ollama',
            'ai_model': 'llama3.2',
            'log_level': 'INFO',
        }
    )
