"""
Mudbrick v2 -- Tests for Session Manager
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.adapters.local_kv import LocalKVAdapter
from app.services.adapters.local_storage import LocalBlobAdapter
from app.services.session_manager import SessionManager


@pytest.fixture
def session_mgr(tmp_data_dir: Path) -> SessionManager:
    """Create a SessionManager with local adapters pointing to tmp dir."""
    blob = LocalBlobAdapter(str(tmp_data_dir))
    kv = LocalKVAdapter(str(tmp_data_dir))
    mgr = SessionManager(blob=blob, kv=kv)
    mgr.max_versions = 5  # Smaller limit for testing
    return mgr


@pytest.mark.asyncio
class TestSessionManager:
    async def test_create_session(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes, "test.pdf")
        assert meta.session_id
        assert meta.file_name == "test.pdf"
        assert meta.file_size == len(sample_pdf_bytes)
        assert meta.current_version == 1
        assert len(meta.operations) == 1
        assert meta.operations[0].operation == "upload"

    async def test_get_session(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        retrieved = await session_mgr.get_session(meta.session_id)
        assert retrieved is not None
        assert retrieved.session_id == meta.session_id

    async def test_get_nonexistent_session(self, session_mgr: SessionManager):
        result = await session_mgr.get_session("nonexistent")
        assert result is None

    async def test_get_current_pdf(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        pdf = await session_mgr.get_current_pdf(meta.session_id)
        assert pdf == sample_pdf_bytes

    async def test_save_pdf_creates_version(
        self, session_mgr: SessionManager, sample_pdf_bytes: bytes
    ):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        sid = meta.session_id

        new_pdf = sample_pdf_bytes + b"\n% modified"
        version = await session_mgr.save_pdf(sid, new_pdf, "rotate")
        assert version == 2

        updated = await session_mgr.get_session(sid)
        assert updated is not None
        assert updated.current_version == 2
        assert updated.max_version == 2

        # Current PDF should be the new one
        current = await session_mgr.get_current_pdf(sid)
        assert current == new_pdf

    async def test_undo_redo(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        sid = meta.session_id

        # Make a modification
        modified = sample_pdf_bytes + b"\n% v2"
        await session_mgr.save_pdf(sid, modified, "rotate")

        # Undo
        result = await session_mgr.undo(sid)
        assert result is not None
        assert result.version == 1

        # Current should be original
        current = await session_mgr.get_current_pdf(sid)
        assert current == sample_pdf_bytes

        # Redo
        result = await session_mgr.redo(sid)
        assert result is not None
        assert result.version == 2

        current = await session_mgr.get_current_pdf(sid)
        assert current == modified

    async def test_undo_at_beginning(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        result = await session_mgr.undo(meta.session_id)
        assert result is None

    async def test_redo_at_end(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        result = await session_mgr.redo(meta.session_id)
        assert result is None

    async def test_save_truncates_redo_history(
        self, session_mgr: SessionManager, sample_pdf_bytes: bytes
    ):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        sid = meta.session_id

        # Create v2 and v3
        await session_mgr.save_pdf(sid, sample_pdf_bytes + b" v2", "edit1")
        await session_mgr.save_pdf(sid, sample_pdf_bytes + b" v3", "edit2")

        # Undo back to v1
        await session_mgr.undo(sid)
        await session_mgr.undo(sid)

        # Make a new edit from v1 -- should truncate v2 and v3
        await session_mgr.save_pdf(sid, sample_pdf_bytes + b" branch", "branch")

        updated = await session_mgr.get_session(sid)
        assert updated is not None
        assert updated.current_version == 2
        assert updated.max_version == 2

        # Redo should not be possible (history was truncated)
        result = await session_mgr.redo(sid)
        assert result is None

    async def test_version_eviction(
        self, session_mgr: SessionManager, sample_pdf_bytes: bytes
    ):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        sid = meta.session_id

        # Create versions up to the limit (max_versions=5)
        for i in range(6):
            await session_mgr.save_pdf(
                sid, sample_pdf_bytes + f" v{i+2}".encode(), f"edit{i+1}"
            )

        updated = await session_mgr.get_session(sid)
        assert updated is not None
        assert updated.current_version == 7
        # Oldest version should have been evicted
        assert updated.oldest_version > 1

    async def test_delete_session(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        sid = meta.session_id

        deleted = await session_mgr.delete_session(sid)
        assert deleted is True

        # Session should be gone
        assert await session_mgr.get_session(sid) is None
        assert await session_mgr.get_current_pdf(sid) is None

    async def test_delete_nonexistent_session(self, session_mgr: SessionManager):
        deleted = await session_mgr.delete_session("nonexistent")
        assert deleted is False

    async def test_get_versions(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        sid = meta.session_id

        await session_mgr.save_pdf(sid, sample_pdf_bytes + b" v2", "rotate")
        await session_mgr.save_pdf(sid, sample_pdf_bytes + b" v3", "delete")

        versions = await session_mgr.get_versions(sid)
        assert len(versions) == 3
        assert versions[0].operation == "upload"
        assert versions[1].operation == "rotate"
        assert versions[2].operation == "delete"
        assert versions[2].is_current is True

    async def test_update_metadata(self, session_mgr: SessionManager, sample_pdf_bytes: bytes):
        meta = await session_mgr.create_session(sample_pdf_bytes)
        updated = await session_mgr.update_metadata(
            meta.session_id, page_count=10, file_name="renamed.pdf"
        )
        assert updated.page_count == 10
        assert updated.file_name == "renamed.pdf"
