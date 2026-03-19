"""
Mudbrick v2 -- FastAPI Dependencies (Desktop)

Shared dependencies for route handlers.
"""

from __future__ import annotations

from fastapi import HTTPException

from .models.document import SessionMetadata
from .services.session_manager import SessionManager

# Singleton session manager (initialized on first use)
_session_manager: SessionManager | None = None


def get_session_manager() -> SessionManager:
    """Get the singleton SessionManager instance."""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager


def reset_session_manager() -> None:
    """Reset the singleton (for testing)."""
    global _session_manager
    _session_manager = None


async def get_session(sid: str) -> SessionMetadata:
    """FastAPI dependency: look up a session by ID, raise 404 if not found."""
    sm = get_session_manager()
    session = sm.get_session(sid)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {sid}")
    return session
