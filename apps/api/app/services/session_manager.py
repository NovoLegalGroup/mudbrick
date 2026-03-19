"""
Mudbrick v2 -- Session Manager

Manages document editing sessions: create, get, update, version, undo/redo, cleanup.
All storage is delegated to the Blob and KV adapters.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Optional

from ..config import settings
from ..models.document import (
    OperationRecord,
    SessionMetadata,
    UndoRedoResponse,
    VersionInfo,
)
from .blob_storage import BlobStorageAdapter, KVStorageAdapter, get_blob_adapter, get_kv_adapter


class SessionManager:
    """Manages document editing sessions with versioning support."""

    def __init__(
        self,
        blob: Optional[BlobStorageAdapter] = None,
        kv: Optional[KVStorageAdapter] = None,
    ) -> None:
        self.blob = blob or get_blob_adapter()
        self.kv = kv or get_kv_adapter()
        self.max_versions = settings.max_versions

    def _session_key(self, sid: str) -> str:
        return f"session:{sid}"

    def _blob_current(self, sid: str) -> str:
        return f"sessions/{sid}/current.pdf"

    def _blob_version(self, sid: str, version: int) -> str:
        return f"sessions/{sid}/versions/v{version}.pdf"

    async def create_session(
        self, pdf_bytes: bytes, file_name: str = "document.pdf"
    ) -> SessionMetadata:
        """Create a new editing session from uploaded PDF bytes."""
        sid = uuid.uuid4().hex[:12]

        # Store the PDF as current + v1
        await self.blob.put(self._blob_current(sid), pdf_bytes, "application/pdf")
        await self.blob.put(self._blob_version(sid, 1), pdf_bytes, "application/pdf")

        # Get page count (will be updated by caller with actual count from PyMuPDF)
        meta = SessionMetadata(
            session_id=sid,
            file_name=file_name,
            file_size=len(pdf_bytes),
            current_version=1,
            oldest_version=1,
            max_version=1,
            operations=[
                OperationRecord(version=1, operation="upload"),
            ],
        )
        await self.kv.set(self._session_key(sid), meta.model_dump())
        return meta

    async def get_session(self, sid: str) -> Optional[SessionMetadata]:
        """Get session metadata. Returns None if session doesn't exist."""
        data = await self.kv.get(self._session_key(sid))
        if data is None:
            return None
        return SessionMetadata(**data)

    async def update_metadata(self, sid: str, **kwargs) -> SessionMetadata:
        """Update specific fields on session metadata."""
        meta = await self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")
        update_data = meta.model_dump()
        update_data.update(kwargs)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        updated = SessionMetadata(**update_data)
        await self.kv.set(self._session_key(sid), updated.model_dump())
        return updated

    async def get_current_pdf(self, sid: str) -> Optional[bytes]:
        """Download the current version of the PDF."""
        return await self.blob.get(self._blob_current(sid))

    async def save_pdf(self, sid: str, pdf_bytes: bytes, operation: str) -> int:
        """Save a new version of the PDF after an operation.

        Returns the new version number.
        """
        meta = await self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")

        new_version = meta.current_version + 1

        # Save new version to Blob
        await self.blob.put(self._blob_current(sid), pdf_bytes, "application/pdf")
        await self.blob.put(
            self._blob_version(sid, new_version), pdf_bytes, "application/pdf"
        )

        # Truncate redo history (we branched from current)
        for v in range(new_version + 1, meta.max_version + 1):
            await self.blob.delete(self._blob_version(sid, v))

        # Evict old versions if over limit
        oldest = meta.oldest_version
        while new_version - oldest >= self.max_versions:
            await self.blob.delete(self._blob_version(sid, oldest))
            oldest += 1

        # Update metadata
        operations = meta.operations + [
            OperationRecord(version=new_version, operation=operation)
        ]
        await self.update_metadata(
            sid,
            current_version=new_version,
            max_version=new_version,
            oldest_version=oldest,
            file_size=len(pdf_bytes),
            operations=[op.model_dump() for op in operations],
        )

        return new_version

    async def undo(self, sid: str) -> Optional[UndoRedoResponse]:
        """Undo to the previous version. Returns None if nothing to undo."""
        meta = await self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")

        if meta.current_version <= meta.oldest_version:
            return None  # Nothing to undo

        prev_version = meta.current_version - 1
        prev_pdf = await self.blob.get(self._blob_version(sid, prev_version))
        if prev_pdf is None:
            return None

        # Restore previous version as current
        await self.blob.put(self._blob_current(sid), prev_pdf, "application/pdf")

        # Find the operation name for the previous version
        operation = "undo"
        for op in meta.operations:
            if op.version == prev_version:
                operation = op.operation
                break

        await self.update_metadata(sid, current_version=prev_version)

        return UndoRedoResponse(
            version=prev_version, page_count=meta.page_count, operation=operation
        )

    async def redo(self, sid: str) -> Optional[UndoRedoResponse]:
        """Redo to the next version. Returns None if nothing to redo."""
        meta = await self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")

        if meta.current_version >= meta.max_version:
            return None  # Nothing to redo

        next_version = meta.current_version + 1
        next_pdf = await self.blob.get(self._blob_version(sid, next_version))
        if next_pdf is None:
            return None

        # Restore next version as current
        await self.blob.put(self._blob_current(sid), next_pdf, "application/pdf")

        # Find the operation name
        operation = "redo"
        for op in meta.operations:
            if op.version == next_version:
                operation = op.operation
                break

        await self.update_metadata(sid, current_version=next_version)

        return UndoRedoResponse(
            version=next_version, page_count=meta.page_count, operation=operation
        )

    async def delete_session(self, sid: str) -> bool:
        """Delete a session and all its data."""
        meta = await self.get_session(sid)
        if meta is None:
            return False

        # Delete all Blob data
        await self.blob.delete_prefix(f"sessions/{sid}/")
        # Delete KV metadata
        await self.kv.delete(self._session_key(sid))
        # Delete any OCR job entries
        await self.kv.delete(f"ocr:{sid}")

        return True

    async def get_versions(self, sid: str) -> list[VersionInfo]:
        """Get list of available versions for a session."""
        meta = await self.get_session(sid)
        if meta is None:
            return []

        versions: list[VersionInfo] = []
        for op in meta.operations:
            if op.version >= meta.oldest_version and op.version <= meta.max_version:
                versions.append(
                    VersionInfo(
                        version=op.version,
                        operation=op.operation,
                        timestamp=op.timestamp,
                        is_current=(op.version == meta.current_version),
                    )
                )
        return versions

    async def cleanup_expired_sessions(self, max_age_hours: Optional[int] = None) -> int:
        """Delete sessions older than max_age_hours. Returns count of deleted sessions."""
        max_age = max_age_hours or settings.session_ttl_hours
        sessions = await self.kv.scan("session:*")
        now = datetime.utcnow()
        deleted = 0

        for key in sessions:
            data = await self.kv.get(key)
            if data is None:
                continue
            try:
                created = datetime.fromisoformat(data["created_at"])
                if now - created > timedelta(hours=max_age):
                    sid = data["session_id"]
                    await self.delete_session(sid)
                    deleted += 1
            except (KeyError, ValueError):
                continue

        return deleted
