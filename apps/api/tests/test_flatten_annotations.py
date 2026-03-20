"""
Mudbrick v2 -- Tests for explicit annotation flattening
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.dependencies import get_session_manager
from app.main import app
from app.services.session_manager import SessionManager


@pytest.fixture
def flatten_session_mgr(tmp_path: Path) -> SessionManager:
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()
    return SessionManager(sessions_dir=sessions_dir)


@pytest.fixture
async def flatten_client(flatten_session_mgr: SessionManager):
    app.dependency_overrides[get_session_manager] = lambda: flatten_session_mgr
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def flatten_pdf_file(tmp_path: Path) -> Path:
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 100), "Base page", fontsize=16)
    pdf_path = tmp_path / "flatten.pdf"
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


async def open_file(client: AsyncClient, file_path: Path) -> str:
    response = await client.post("/api/documents/open", json={"file_path": str(file_path)})
    assert response.status_code == 200
    return response.json()["session_id"]


@pytest.mark.asyncio
class TestFlattenAnnotations:
    async def test_flatten_annotations_into_current_document(
        self,
        flatten_client: AsyncClient,
        flatten_session_mgr: SessionManager,
        flatten_pdf_file: Path,
    ):
        sid = await open_file(flatten_client, flatten_pdf_file)

        response = await flatten_client.post(
            f"/api/export/{sid}/flatten",
            json={
                "annotations": {
                    "1": {
                        "version": "6.0.0",
                        "objects": [
                            {
                                "type": "textbox",
                                "left": 72,
                                "top": 180,
                                "width": 240,
                                "height": 30,
                                "scaleX": 1,
                                "scaleY": 1,
                                "visible": True,
                                "opacity": 1,
                                "fill": "#ff0000",
                                "text": "Flattened note",
                                "fontSize": 14,
                                "fontFamily": "Arial",
                            }
                        ],
                    }
                },
                "options": {"page_width": 612, "page_height": 792},
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["page_count"] == 1
        assert payload["new_version"] >= 2

        pdf_bytes = flatten_session_mgr.get_current_pdf_bytes(sid)
        assert pdf_bytes is not None
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            page_text = doc[0].get_text("text")
            assert "Flattened note" in page_text
        finally:
            doc.close()
