"""
Mudbrick v2 -- Session Manager Tests (Desktop / Local Filesystem)
"""

from pathlib import Path

import pytest

from app.services.session_manager import SessionManager


class TestSessionManager:
    """Tests for local filesystem session manager."""

    def test_open_file(self, session_manager: SessionManager, sample_pdf_file: Path):
        """Opening a file creates a session with correct metadata."""
        meta = session_manager.open_file(str(sample_pdf_file))

        assert meta.session_id
        assert meta.file_path == str(sample_pdf_file)
        assert meta.file_name == "test.pdf"
        assert meta.file_size > 0
        assert meta.current_version == 1
        assert len(meta.operations) == 1
        assert meta.operations[0].operation == "open"

    def test_open_file_creates_working_copy(
        self, session_manager: SessionManager, sample_pdf_file: Path
    ):
        """Opening a file copies it to session dir as current.pdf and v1.pdf."""
        meta = session_manager.open_file(str(sample_pdf_file))
        sid = meta.session_id

        current = session_manager.get_current_pdf_path(sid)
        assert current is not None
        assert current.exists()

        version_path = session_manager._version_pdf_path(sid, 1)
        assert version_path.exists()

    def test_create_session_from_bytes(
        self, session_manager: SessionManager, sample_pdf_bytes: bytes
    ):
        """Generated PDFs can create sessions without a source file on disk."""
        meta = session_manager.create_session_from_bytes(
            "generated.pdf",
            sample_pdf_bytes,
            operation="generated",
        )

        assert meta.file_path == ""
        assert meta.file_name == "generated.pdf"
        assert meta.file_size == len(sample_pdf_bytes)
        assert meta.operations[0].operation == "generated"
        assert session_manager.get_current_pdf_bytes(meta.session_id) == sample_pdf_bytes

    def test_open_file_not_found(self, session_manager: SessionManager):
        """Opening a non-existent file raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            session_manager.open_file("C:/nonexistent/fake.pdf")

    def test_get_current_pdf_bytes(
        self, session_manager: SessionManager, sample_pdf_file: Path, sample_pdf_bytes: bytes
    ):
        """Can read the current PDF as bytes."""
        meta = session_manager.open_file(str(sample_pdf_file))
        data = session_manager.get_current_pdf_bytes(meta.session_id)
        assert data is not None
        assert data == sample_pdf_bytes

    def test_save_current_pdf_creates_version(
        self, session_manager: SessionManager, sample_pdf_file: Path, sample_pdf_bytes: bytes
    ):
        """Saving new PDF bytes creates a new version."""
        meta = session_manager.open_file(str(sample_pdf_file))
        sid = meta.session_id

        new_version = session_manager.save_current_pdf(sid, sample_pdf_bytes, "rotate 90deg")
        assert new_version == 2

        updated = session_manager.get_session(sid)
        assert updated.current_version == 2
        assert updated.max_version == 2

    def test_undo_redo(
        self, session_manager: SessionManager, sample_pdf_file: Path, sample_pdf_bytes: bytes
    ):
        """Undo/redo navigate through version history."""
        meta = session_manager.open_file(str(sample_pdf_file))
        sid = meta.session_id

        # Create v2
        session_manager.save_current_pdf(sid, sample_pdf_bytes, "rotate")

        # Undo to v1
        result = session_manager.undo(sid)
        assert result is not None
        assert result.version == 1

        # Redo to v2
        result = session_manager.redo(sid)
        assert result is not None
        assert result.version == 2

    def test_undo_at_oldest_returns_none(
        self, session_manager: SessionManager, sample_pdf_file: Path
    ):
        """Undo at the oldest version returns None."""
        meta = session_manager.open_file(str(sample_pdf_file))
        result = session_manager.undo(meta.session_id)
        assert result is None

    def test_redo_at_newest_returns_none(
        self, session_manager: SessionManager, sample_pdf_file: Path
    ):
        """Redo at the newest version returns None."""
        meta = session_manager.open_file(str(sample_pdf_file))
        result = session_manager.redo(meta.session_id)
        assert result is None

    def test_close_session_removes_files(
        self, session_manager: SessionManager, sample_pdf_file: Path
    ):
        """Closing a session removes all session files."""
        meta = session_manager.open_file(str(sample_pdf_file))
        sid = meta.session_id

        session_dir = session_manager._session_dir(sid)
        assert session_dir.exists()

        session_manager.close_session(sid)
        assert not session_dir.exists()
        assert session_manager.get_session(sid) is None

    def test_save_to_original(
        self, session_manager: SessionManager, sample_pdf_file: Path, sample_pdf_bytes: bytes
    ):
        """Save writes current PDF back to original file path."""
        meta = session_manager.open_file(str(sample_pdf_file))
        sid = meta.session_id

        session_manager.save_current_pdf(sid, sample_pdf_bytes, "test op")

        path = session_manager.save_to_original(sid)
        assert path == str(sample_pdf_file)
        assert sample_pdf_file.exists()

    def test_save_as(
        self, session_manager: SessionManager, sample_pdf_file: Path, tmp_path: Path
    ):
        """Save-as writes to a new path and updates session metadata."""
        meta = session_manager.open_file(str(sample_pdf_file))
        sid = meta.session_id

        new_path = tmp_path / "output" / "saved.pdf"
        result = session_manager.save_as(sid, str(new_path))
        assert result == str(new_path)
        assert new_path.exists()

        updated = session_manager.get_session(sid)
        assert updated.file_path == str(new_path)
        assert updated.file_name == "saved.pdf"

    def test_get_versions(
        self, session_manager: SessionManager, sample_pdf_file: Path, sample_pdf_bytes: bytes
    ):
        """get_versions returns all available versions."""
        meta = session_manager.open_file(str(sample_pdf_file))
        sid = meta.session_id

        session_manager.save_current_pdf(sid, sample_pdf_bytes, "rotate")
        session_manager.save_current_pdf(sid, sample_pdf_bytes, "delete")

        versions = session_manager.get_versions(sid)
        assert len(versions) == 3
        assert versions[0].version == 1
        assert versions[0].operation == "open"
        assert versions[2].version == 3
        assert versions[2].is_current

    def test_thumbnail_caching(
        self, session_manager: SessionManager, sample_pdf_file: Path
    ):
        """Thumbnail cache stores and retrieves PNG bytes."""
        meta = session_manager.open_file(str(sample_pdf_file))
        sid = meta.session_id

        assert session_manager.get_cached_thumbnail(sid, 1, 200) is None

        fake_png = b"\x89PNG\r\n\x1a\ntest"
        session_manager.cache_thumbnail(sid, 1, 200, fake_png)

        cached = session_manager.get_cached_thumbnail(sid, 1, 200)
        assert cached == fake_png
