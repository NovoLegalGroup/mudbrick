"""
Mudbrick v2 -- Tests for Page Operations Router (Desktop / File-Path Based)
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies import get_session_manager
from app.services.session_manager import SessionManager


@pytest.fixture
def test_session_mgr(tmp_path: Path) -> SessionManager:
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()
    return SessionManager(sessions_dir=sessions_dir)


@pytest.fixture
async def page_client(test_session_mgr: SessionManager):
    app.dependency_overrides[get_session_manager] = lambda: test_session_mgr
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def multi_page_pdf_file(tmp_path: Path) -> Path:
    """Create a 5-page PDF file and return its path."""
    doc = fitz.open()
    for i in range(5):
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 72), f"Page {i + 1}", fontsize=16)
    pdf_path = tmp_path / "multi.pdf"
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


async def open_file(client: AsyncClient, file_path: Path) -> str:
    """Open a PDF by path and return the session ID."""
    resp = await client.post(
        "/api/documents/open",
        json={"file_path": str(file_path)},
    )
    assert resp.status_code == 200
    return resp.json()["session_id"]


@pytest.mark.asyncio
class TestPageOperations:
    async def test_rotate(self, page_client: AsyncClient, multi_page_pdf_file: Path):
        sid = await open_file(page_client, multi_page_pdf_file)
        resp = await page_client.post(
            f"/api/pages/{sid}/rotate",
            json={"pages": [1, 3], "degrees": 90},
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert resp.json()["page_count"] == 5

    async def test_delete(self, page_client: AsyncClient, multi_page_pdf_file: Path):
        sid = await open_file(page_client, multi_page_pdf_file)
        resp = await page_client.post(
            f"/api/pages/{sid}/delete",
            json={"pages": [2, 4]},
        )
        assert resp.status_code == 200
        assert resp.json()["page_count"] == 3

    async def test_delete_all_fails(
        self, page_client: AsyncClient, multi_page_pdf_file: Path
    ):
        sid = await open_file(page_client, multi_page_pdf_file)
        resp = await page_client.post(
            f"/api/pages/{sid}/delete",
            json={"pages": [1, 2, 3, 4, 5]},
        )
        assert resp.status_code == 400

    async def test_reorder(self, page_client: AsyncClient, multi_page_pdf_file: Path):
        sid = await open_file(page_client, multi_page_pdf_file)
        resp = await page_client.post(
            f"/api/pages/{sid}/reorder",
            json={"order": [5, 4, 3, 2, 1]},
        )
        assert resp.status_code == 200
        assert resp.json()["page_count"] == 5

    async def test_insert_blank(
        self, page_client: AsyncClient, multi_page_pdf_file: Path
    ):
        sid = await open_file(page_client, multi_page_pdf_file)
        resp = await page_client.post(
            f"/api/pages/{sid}/insert",
            json={"after": 2, "size": "letter"},
        )
        assert resp.status_code == 200
        assert resp.json()["page_count"] == 6

    async def test_crop(self, page_client: AsyncClient, multi_page_pdf_file: Path):
        sid = await open_file(page_client, multi_page_pdf_file)
        resp = await page_client.post(
            f"/api/pages/{sid}/crop",
            json={"pages": [1], "box": {"x": 50, "y": 50, "w": 400, "h": 600}},
        )
        assert resp.status_code == 200

    async def test_thumbnail(
        self, page_client: AsyncClient, multi_page_pdf_file: Path
    ):
        sid = await open_file(page_client, multi_page_pdf_file)
        resp = await page_client.get(
            f"/api/pages/{sid}/1/thumbnail?width=200"
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
        assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"
