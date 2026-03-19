"""
Mudbrick v2 -- Document and Session Pydantic Models
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
    """Metadata for a document editing session, stored in KV."""

    session_id: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
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


class SessionCreateResponse(BaseModel):
    """Response from creating a new session (upload)."""

    session_id: str
    page_count: int
    file_size: int


class SessionInfoResponse(BaseModel):
    """Response from getting session info."""

    session_id: str
    file_name: str
    file_size: int
    page_count: int
    current_version: int
    versions: list[VersionInfo] = Field(default_factory=list)
    created_at: str
    updated_at: str


class UndoRedoResponse(BaseModel):
    """Response from undo/redo operations."""

    version: int
    page_count: int
    operation: str


class ChunkUploadResponse(BaseModel):
    """Response from uploading a chunk."""

    chunk_index: int
    received: bool = True


class ChunkCompleteRequest(BaseModel):
    """Request to assemble uploaded chunks."""

    session_id: str
    chunk_count: int
    file_name: str = "document.pdf"
