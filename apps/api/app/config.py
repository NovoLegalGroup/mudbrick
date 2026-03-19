"""
Mudbrick v2 -- Application Configuration

Desktop application: all storage is local filesystem under %APPDATA%/mudbrick.
No cloud services, no Vercel, no Blob/KV.
"""

from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings


def _default_data_dir() -> str:
    """Get the default data directory: %APPDATA%/mudbrick on Windows."""
    appdata = os.environ.get("APPDATA")
    if appdata:
        return str(Path(appdata) / "mudbrick")
    # Fallback for non-Windows or missing APPDATA
    return str(Path.home() / ".mudbrick")


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Local filesystem directory for all session data
    data_dir: str = _default_data_dir()

    # OCR
    tesseract_cmd: str = "tesseract"

    # Server
    api_port: int = 8000

    # Session
    max_versions: int = 50
    stale_session_days: int = 7

    model_config = {
        "env_prefix": "MUDBRICK_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def sessions_dir(self) -> Path:
        """Directory for session data: {data_dir}/sessions/"""
        p = Path(self.data_dir) / "sessions"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def logs_dir(self) -> Path:
        """Directory for log files: {data_dir}/logs/"""
        p = Path(self.data_dir) / "logs"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def preferences_path(self) -> Path:
        """Path to user preferences file."""
        return Path(self.data_dir) / "preferences.json"


settings = Settings()
