"""
Mudbrick v2 -- Tests for Document Router (Desktop / File-Path Based)
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies import get_session_manager, reset_session_manager
from app.services.session_manager import SessionManager


@pytest.fixture
def valid_pdf_file(tmp_path: Path) -> Path:
    """Create a valid PDF file using PyMuPDF and return its path."""
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), "Test document", fontsize=12)
    pdf_path = tmp_path / "test.pdf"
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


@pytest.fixture
def test_session_mgr(tmp_path: Path) -> SessionManager:
    """Session manager with temp directory."""
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()
    return SessionManager(sessions_dir=sessions_dir)


@pytest.fixture
async def doc_client(test_session_mgr: SessionManager):
    """Create test client with overridden session manager."""
    app.dependency_overrides[get_session_manager] = lambda: test_session_mgr
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.asyncio
class TestDocumentOpen:
    async def test_open_pdf_by_path(self, doc_client: AsyncClient, valid_pdf_file: Path):
        """Open a PDF by local file path."""
        response = await doc_client.post(
            "/api/documents/open",
            json={"file_path": str(valid_pdf_file)},
        )
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert data["page_count"] == 1
        assert data["file_size"] > 0

    async def test_open_nonexistent_file(self, doc_client: AsyncClient):
        """Opening a non-existent file returns 404."""
        response = await doc_client.post(
            "/api/documents/open",
            json={"file_path": "C:/nonexistent/fake.pdf"},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestDocumentOperations:
    async def test_get_document_info(
        self, doc_client: AsyncClient, valid_pdf_file: Path
    ):
        # Open first
        open_resp = await doc_client.post(
            "/api/documents/open",
            json={"file_path": str(valid_pdf_file)},
        )
        sid = open_resp.json()["session_id"]

        # Get info
        response = await doc_client.get(f"/api/documents/{sid}")
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == sid
        assert data["page_count"] == 1
        assert data["file_path"] == str(valid_pdf_file)

    async def test_get_nonexistent_document(self, doc_client: AsyncClient):
        response = await doc_client.get("/api/documents/nonexistent")
        assert response.status_code == 404

    async def test_save_document(
        self, doc_client: AsyncClient, valid_pdf_file: Path
    ):
        open_resp = await doc_client.post(
            "/api/documents/open",
            json={"file_path": str(valid_pdf_file)},
        )
        sid = open_resp.json()["session_id"]

        response = await doc_client.post(f"/api/documents/{sid}/save")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["file_path"] == str(valid_pdf_file)

    async def test_save_as(
        self, doc_client: AsyncClient, valid_pdf_file: Path, tmp_path: Path
    ):
        open_resp = await doc_client.post(
            "/api/documents/open",
            json={"file_path": str(valid_pdf_file)},
        )
        sid = open_resp.json()["session_id"]

        new_path = str(tmp_path / "output" / "saved.pdf")
        response = await doc_client.post(
            f"/api/documents/{sid}/save-as",
            json={"file_path": new_path},
        )
        assert response.status_code == 200
        assert response.json()["file_path"] == new_path
        assert Path(new_path).exists()

    async def test_close_document(
        self, doc_client: AsyncClient, valid_pdf_file: Path
    ):
        open_resp = await doc_client.post(
            "/api/documents/open",
            json={"file_path": str(valid_pdf_file)},
        )
        sid = open_resp.json()["session_id"]

        response = await doc_client.post(f"/api/documents/{sid}/close")
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Should be gone
        response = await doc_client.get(f"/api/documents/{sid}")
        assert response.status_code == 404

    async def test_undo_nothing(
        self, doc_client: AsyncClient, valid_pdf_file: Path
    ):
        open_resp = await doc_client.post(
            "/api/documents/open",
            json={"file_path": str(valid_pdf_file)},
        )
        sid = open_resp.json()["session_id"]

        response = await doc_client.post(f"/api/documents/{sid}/undo")
        assert response.status_code == 400
