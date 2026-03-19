"""
Mudbrick v2 -- Document and Session Pydantic Models (Desktop)
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class OperationRecord(BaseModel):
    """Record of an operation that created a version."""

    version: int
    operation: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class SessionMetadata(BaseModel):
    """Metadata for a document editing session, stored as JSON on local filesystem."""

    session_id: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    file_path: str = ""  # Original file path on disk (e.g., "C:/docs/contract.pdf")
    file_name: str = ""
    file_size: int = 0
    page_count: int = 0
    current_version: int = 1
    oldest_version: int = 1
    max_version: int = 1
    operations: list[OperationRecord] = Field(default_factory=list)


class VersionInfo(BaseModel):
    """Information about a specific version of a document."""

    version: int
    operation: str
    timestamp: str
    is_current: bool = False


# ── Request/Response Models ──


class OpenFileRequest(BaseModel):
    """Request to open a file by local path."""

    file_path: str


class SessionCreateResponse(BaseModel):
    """Response from opening a file."""

    session_id: str
    page_count: int
    file_size: int


class SessionInfoResponse(BaseModel):
    """Response from getting session info."""

    session_id: str
    file_path: str
    file_name: str
    file_size: int
    page_count: int
    current_version: int
    versions: list[VersionInfo] = Field(default_factory=list)
    created_at: str
    updated_at: str


class SaveRequest(BaseModel):
    """Request to save-as to a new path."""

    file_path: str


class SaveResponse(BaseModel):
    """Response from save/save-as."""

    success: bool = True
    file_path: str


class UndoRedoResponse(BaseModel):
    """Response from undo/redo operations."""

    version: int
    page_count: int
    operation: str
