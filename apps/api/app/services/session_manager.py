"""
Mudbrick v2 -- Session Manager (Desktop / Local Filesystem)

Manages document editing sessions with local file versioning.
All storage is on the local filesystem under %APPDATA%/mudbrick/sessions/.

Session structure:
    {sessions_dir}/{sid}/
        metadata.json       - Session metadata (JSON)
        current.pdf         - Working copy of the document
        versions/
            v1.pdf          - Original (copy of source file)
            v2.pdf          - After first operation
            ...
        thumbnails/
            page_1_w200.png - Cached thumbnails
"""

from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from ..config import settings
from ..models.document import (
    OperationRecord,
    SessionMetadata,
    UndoRedoResponse,
    VersionInfo,
)


class SessionManager:
    """Manages document editing sessions with local filesystem versioning."""

    def __init__(self, sessions_dir: Optional[Path] = None) -> None:
        self.sessions_dir = sessions_dir or settings.sessions_dir
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        self.max_versions = settings.max_versions
        # In-memory cache of active sessions
        self._sessions: dict[str, SessionMetadata] = {}

    def _session_dir(self, sid: str) -> Path:
        return self.sessions_dir / sid

    def _versions_dir(self, sid: str) -> Path:
        return self._session_dir(sid) / "versions"

    def _thumbnails_dir(self, sid: str) -> Path:
        return self._session_dir(sid) / "thumbnails"

    def _metadata_path(self, sid: str) -> Path:
        return self._session_dir(sid) / "metadata.json"

    def _current_pdf_path(self, sid: str) -> Path:
        return self._session_dir(sid) / "current.pdf"

    def _version_pdf_path(self, sid: str, version: int) -> Path:
        return self._versions_dir(sid) / f"v{version}.pdf"

    def _save_metadata(self, sid: str, meta: SessionMetadata) -> None:
        """Write session metadata to disk and update in-memory cache."""
        self._sessions[sid] = meta
        meta_path = self._metadata_path(sid)
        meta_path.write_text(meta.model_dump_json(indent=2), encoding="utf-8")

    def _load_metadata(self, sid: str) -> Optional[SessionMetadata]:
        """Load session metadata from disk or in-memory cache."""
        if sid in self._sessions:
            return self._sessions[sid]
        meta_path = self._metadata_path(sid)
        if not meta_path.exists():
            return None
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        meta = SessionMetadata(**data)
        self._sessions[sid] = meta
        return meta

    # ── Open File ──

    def open_file(self, file_path: str) -> SessionMetadata:
        """Open a PDF file by local path and create a new editing session.

        The file is copied to the session directory (never modified in place).
        """
        source = Path(file_path)
        if not source.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        if not source.is_file():
            raise ValueError(f"Not a file: {file_path}")

        sid = uuid.uuid4().hex[:12]
        session_dir = self._session_dir(sid)
        session_dir.mkdir(parents=True)
        self._versions_dir(sid).mkdir()
        self._thumbnails_dir(sid).mkdir()

        # Copy source file to session working area
        shutil.copy2(str(source), str(self._current_pdf_path(sid)))
        shutil.copy2(str(source), str(self._version_pdf_path(sid, 1)))

        file_size = source.stat().st_size

        meta = SessionMetadata(
            session_id=sid,
            file_path=file_path,
            file_name=source.name,
            file_size=file_size,
            current_version=1,
            oldest_version=1,
            max_version=1,
            operations=[
                OperationRecord(version=1, operation="open"),
            ],
        )
        self._save_metadata(sid, meta)
        return meta

    def create_session_from_bytes(
        self,
        file_name: str,
        pdf_bytes: bytes,
        *,
        file_path: str = "",
        operation: str = "create",
    ) -> SessionMetadata:
        """Create a new editing session from PDF bytes already in memory."""
        sid = uuid.uuid4().hex[:12]
        session_dir = self._session_dir(sid)
        session_dir.mkdir(parents=True)
        self._versions_dir(sid).mkdir()
        self._thumbnails_dir(sid).mkdir()

        self._current_pdf_path(sid).write_bytes(pdf_bytes)
        self._version_pdf_path(sid, 1).write_bytes(pdf_bytes)

        resolved_name = file_name or Path(file_path).name or "document.pdf"
        meta = SessionMetadata(
            session_id=sid,
            file_path=file_path,
            file_name=resolved_name,
            file_size=len(pdf_bytes),
            current_version=1,
            oldest_version=1,
            max_version=1,
            operations=[
                OperationRecord(version=1, operation=operation),
            ],
        )
        self._save_metadata(sid, meta)
        return meta

    # ── Session Queries ──

    def get_session(self, sid: str) -> Optional[SessionMetadata]:
        """Get session metadata. Returns None if not found."""
        return self._load_metadata(sid)

    def update_metadata(self, sid: str, **kwargs) -> SessionMetadata:
        """Update specific fields on session metadata."""
        meta = self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")
        update_data = meta.model_dump()
        update_data.update(kwargs)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        updated = SessionMetadata(**update_data)
        self._save_metadata(sid, updated)
        return updated

    # ── PDF Access ──

    def get_current_pdf_path(self, sid: str) -> Optional[Path]:
        """Get the filesystem path to the current working PDF."""
        path = self._current_pdf_path(sid)
        return path if path.exists() else None

    def get_current_pdf_bytes(self, sid: str) -> Optional[bytes]:
        """Read current PDF as bytes."""
        path = self.get_current_pdf_path(sid)
        if path is None:
            return None
        return path.read_bytes()

    # ── Version Management ──

    def create_version(self, sid: str, operation: str) -> int:
        """Save the current PDF as a new version after an operation.

        Returns the new version number.
        """
        meta = self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")

        new_v = meta.current_version + 1
        current_path = self._current_pdf_path(sid)

        # Save current as new version
        shutil.copy2(str(current_path), str(self._version_pdf_path(sid, new_v)))

        # Truncate redo future (we branched from current)
        for v in range(new_v + 1, meta.max_version + 1):
            vpath = self._version_pdf_path(sid, v)
            if vpath.exists():
                vpath.unlink()

        # Evict old versions if over limit
        oldest = meta.oldest_version
        while new_v - oldest >= self.max_versions:
            old_path = self._version_pdf_path(sid, oldest)
            if old_path.exists():
                old_path.unlink()
            oldest += 1

        # Update metadata
        operations = meta.operations + [
            OperationRecord(version=new_v, operation=operation)
        ]
        self.update_metadata(
            sid,
            current_version=new_v,
            max_version=new_v,
            oldest_version=oldest,
            file_size=current_path.stat().st_size,
            operations=[op.model_dump() for op in operations],
        )

        # Clear thumbnail cache (pages may have changed)
        self._clear_thumbnails(sid)

        return new_v

    def save_current_pdf(self, sid: str, pdf_bytes: bytes, operation: str) -> int:
        """Write new PDF bytes as current and create a version.

        Returns the new version number.
        """
        current_path = self._current_pdf_path(sid)
        current_path.write_bytes(pdf_bytes)
        return self.create_version(sid, operation)

    # ── Undo / Redo ──

    def undo(self, sid: str) -> Optional[UndoRedoResponse]:
        """Undo to the previous version. Returns None if nothing to undo."""
        meta = self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")

        if meta.current_version <= meta.oldest_version:
            return None

        prev_version = meta.current_version - 1
        prev_path = self._version_pdf_path(sid, prev_version)
        if not prev_path.exists():
            return None

        # Restore previous version as current
        shutil.copy2(str(prev_path), str(self._current_pdf_path(sid)))

        # Find the operation name for the previous version
        operation = "undo"
        for op in meta.operations:
            if op.version == prev_version:
                operation = op.operation
                break

        self.update_metadata(sid, current_version=prev_version)
        self._clear_thumbnails(sid)

        return UndoRedoResponse(
            version=prev_version, page_count=meta.page_count, operation=operation
        )

    def redo(self, sid: str) -> Optional[UndoRedoResponse]:
        """Redo to the next version. Returns None if nothing to redo."""
        meta = self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")

        if meta.current_version >= meta.max_version:
            return None

        next_version = meta.current_version + 1
        next_path = self._version_pdf_path(sid, next_version)
        if not next_path.exists():
            return None

        # Restore next version as current
        shutil.copy2(str(next_path), str(self._current_pdf_path(sid)))

        operation = "redo"
        for op in meta.operations:
            if op.version == next_version:
                operation = op.operation
                break

        self.update_metadata(sid, current_version=next_version)
        self._clear_thumbnails(sid)

        return UndoRedoResponse(
            version=next_version, page_count=meta.page_count, operation=operation
        )

    # ── Save ──

    def save_to_original(self, sid: str) -> str:
        """Save the current working PDF back to the original file path.

        Returns the file path written to.
        """
        meta = self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")
        if not meta.file_path:
            raise ValueError("No original file path recorded for this session")

        current_path = self._current_pdf_path(sid)
        dest = Path(meta.file_path)
        shutil.copy2(str(current_path), str(dest))
        return str(dest)

    def save_as(self, sid: str, new_path: str) -> str:
        """Save the current working PDF to a new file path.

        Updates the session's file_path to the new location.
        Returns the file path written to.
        """
        meta = self.get_session(sid)
        if meta is None:
            raise ValueError(f"Session not found: {sid}")

        current_path = self._current_pdf_path(sid)
        dest = Path(new_path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(current_path), str(dest))

        # Update session to point to new path
        self.update_metadata(
            sid,
            file_path=new_path,
            file_name=dest.name,
        )
        return str(dest)

    # ── Close / Cleanup ──

    def close_session(self, sid: str) -> bool:
        """Close a session and clean up all temp files."""
        session_dir = self._session_dir(sid)
        if session_dir.exists():
            shutil.rmtree(str(session_dir), ignore_errors=True)
        self._sessions.pop(sid, None)
        return True

    def get_versions(self, sid: str) -> list[VersionInfo]:
        """Get list of available versions for a session."""
        meta = self.get_session(sid)
        if meta is None:
            return []

        versions: list[VersionInfo] = []
        for op in meta.operations:
            if meta.oldest_version <= op.version <= meta.max_version:
                versions.append(
                    VersionInfo(
                        version=op.version,
                        operation=op.operation,
                        timestamp=op.timestamp,
                        is_current=(op.version == meta.current_version),
                    )
                )
        return versions

    def cleanup_stale_sessions(self, max_age_days: Optional[int] = None) -> int:
        """Delete sessions older than max_age_days. Returns count deleted."""
        max_age = max_age_days or settings.stale_session_days
        now = datetime.utcnow()
        deleted = 0

        if not self.sessions_dir.exists():
            return 0

        for sid_dir in self.sessions_dir.iterdir():
            if not sid_dir.is_dir():
                continue
            meta_path = sid_dir / "metadata.json"
            if not meta_path.exists():
                # No metadata = orphaned session, remove it
                shutil.rmtree(str(sid_dir), ignore_errors=True)
                deleted += 1
                continue
            try:
                data = json.loads(meta_path.read_text(encoding="utf-8"))
                created = datetime.fromisoformat(data["created_at"])
                if (now - created).days > max_age:
                    shutil.rmtree(str(sid_dir), ignore_errors=True)
                    self._sessions.pop(data.get("session_id", ""), None)
                    deleted += 1
            except (KeyError, ValueError, json.JSONDecodeError):
                continue

        return deleted

    # ── Thumbnail Cache ──

    def get_cached_thumbnail(self, sid: str, page: int, width: int) -> Optional[bytes]:
        """Get a cached thumbnail, or None."""
        path = self._thumbnails_dir(sid) / f"page_{page}_w{width}.png"
        if path.exists():
            return path.read_bytes()
        return None

    def cache_thumbnail(self, sid: str, page: int, width: int, png_bytes: bytes) -> None:
        """Cache a thumbnail PNG."""
        thumb_dir = self._thumbnails_dir(sid)
        thumb_dir.mkdir(parents=True, exist_ok=True)
        path = thumb_dir / f"page_{page}_w{width}.png"
        path.write_bytes(png_bytes)

    def _clear_thumbnails(self, sid: str) -> None:
        """Clear all cached thumbnails for a session."""
        thumb_dir = self._thumbnails_dir(sid)
        if thumb_dir.exists():
            shutil.rmtree(str(thumb_dir), ignore_errors=True)
            thumb_dir.mkdir(parents=True, exist_ok=True)
