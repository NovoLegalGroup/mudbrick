"""
Mudbrick v2 -- Tests for Security Router
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
def security_session_mgr(tmp_path: Path) -> SessionManager:
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()
    return SessionManager(sessions_dir=sessions_dir)


@pytest.fixture
async def security_client(security_session_mgr: SessionManager):
    app.dependency_overrides[get_session_manager] = lambda: security_session_mgr
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_pdf_with_metadata(tmp_path: Path) -> bytes:
    """Create a PDF with metadata."""
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), "Test document with metadata", fontsize=16)
    doc.set_metadata({
        "title": "Test Document",
        "author": "Test Author",
        "subject": "Test Subject",
        "keywords": "test, document",
    })
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


async def _create_session(client: AsyncClient, tmp_path: Path, pdf_bytes: bytes) -> str:
    """Helper to create a session from PDF bytes."""
    pdf_path = tmp_path / "test.pdf"
    pdf_path.write_bytes(pdf_bytes)
    resp = await client.post("/api/documents/open", json={"file_path": str(pdf_path)})
    assert resp.status_code == 200
    return resp.json()["session_id"]


@pytest.mark.asyncio
async def test_get_metadata(security_client: AsyncClient, test_pdf_with_metadata: bytes, tmp_path: Path):
    """Should retrieve PDF metadata."""
    sid = await _create_session(security_client, tmp_path, test_pdf_with_metadata)
    resp = await security_client.get(f"/api/security/{sid}/metadata")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Document"
    assert data["author"] == "Test Author"


@pytest.mark.asyncio
async def test_update_metadata(security_client: AsyncClient, test_pdf_with_metadata: bytes, tmp_path: Path):
    """Should update PDF metadata fields."""
    sid = await _create_session(security_client, tmp_path, test_pdf_with_metadata)
    resp = await security_client.post(f"/api/security/{sid}/metadata", json={
        "title": "Updated Title",
        "author": "Updated Author",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "title" in data["updated_fields"]
    assert "author" in data["updated_fields"]

    # Verify the update persisted
    resp2 = await security_client.get(f"/api/security/{sid}/metadata")
    assert resp2.json()["title"] == "Updated Title"


@pytest.mark.asyncio
async def test_sanitize(security_client: AsyncClient, test_pdf_with_metadata: bytes, tmp_path: Path):
    """Should strip metadata from the PDF."""
    sid = await _create_session(security_client, tmp_path, test_pdf_with_metadata)
    resp = await security_client.post(f"/api/security/{sid}/sanitize")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["removed"]) > 0

    # Verify metadata is gone
    resp2 = await security_client.get(f"/api/security/{sid}/metadata")
    meta = resp2.json()
    assert meta["title"] == ""
    assert meta["author"] == ""


@pytest.mark.asyncio
async def test_encrypt(security_client: AsyncClient, test_pdf_with_metadata: bytes, tmp_path: Path):
    """Should encrypt the PDF with AES-256."""
    sid = await _create_session(security_client, tmp_path, test_pdf_with_metadata)
    resp = await security_client.post(f"/api/security/{sid}/encrypt", json={
        "owner_password": "owner123",
        "user_password": "user123",
        "allow_print": True,
        "allow_copy": False,
        "allow_modify": False,
        "allow_annotate": True,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["encrypted"] is True
    assert data["permissions"]["print"] is True
    assert data["permissions"]["copy"] is False


@pytest.mark.asyncio
async def test_session_not_found(security_client: AsyncClient):
    """Should return 404 for nonexistent session."""
    resp = await security_client.get("/api/security/nonexistent/metadata")
    assert resp.status_code == 404
