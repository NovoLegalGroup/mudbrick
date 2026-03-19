"""
Mudbrick v2 -- Tests for Export Router
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.dependencies import get_session_manager
from app.services.session_manager import SessionManager
from app.services.adapters.local_storage import LocalBlobAdapter
from app.services.adapters.local_kv import LocalKVAdapter


@pytest.fixture
def test_session_mgr(tmp_data_dir: Path) -> SessionManager:
    blob = LocalBlobAdapter(str(tmp_data_dir))
    kv = LocalKVAdapter(str(tmp_data_dir))
    return SessionManager(blob=blob, kv=kv)


@pytest.fixture
async def export_client(test_session_mgr: SessionManager):
    app.dependency_overrides[get_session_manager] = lambda: test_session_mgr
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), "Test document for export", fontsize=16)
    data = doc.tobytes()
    doc.close()
    return data


async def create_session(client: AsyncClient, pdf_bytes: bytes) -> str:
    resp = await client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    )
    return resp.json()["session_id"]


@pytest.mark.asyncio
class TestExport:
    async def test_export_no_annotations(
        self, export_client: AsyncClient, test_pdf: bytes
    ):
        sid = await create_session(export_client, test_pdf)
        resp = await export_client.post(
            f"/api/export/{sid}",
            json={"annotations": {}, "options": {}},
        )
        assert resp.status_code == 200
        assert "download_url" in resp.json()

    async def test_export_with_annotations(
        self, export_client: AsyncClient, test_pdf: bytes
    ):
        sid = await create_session(export_client, test_pdf)
        resp = await export_client.post(
            f"/api/export/{sid}",
            json={
                "annotations": {
                    "1": {
                        "version": "6.0.0",
                        "objects": [
                            {
                                "type": "rect",
                                "tool": "highlight",
                                "left": 72,
                                "top": 60,
                                "width": 300,
                                "height": 20,
                                "scaleX": 1,
                                "scaleY": 1,
                                "visible": True,
                                "opacity": 0.4,
                                "fill": "#ffff00",
                            },
                            {
                                "type": "textbox",
                                "left": 72,
                                "top": 200,
                                "width": 200,
                                "height": 30,
                                "scaleX": 1,
                                "scaleY": 1,
                                "visible": True,
                                "opacity": 1,
                                "fill": "#ff0000",
                                "text": "Important note",
                                "fontSize": 14,
                                "fontFamily": "Arial",
                            },
                        ],
                    }
                },
                "options": {"page_width": 612, "page_height": 792},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "download_url" in data

        # Verify the exported PDF is valid
        download_resp = await export_client.get(data["download_url"])
        assert download_resp.status_code == 200
        exported = fitz.open(stream=download_resp.content, filetype="pdf")
        assert exported.page_count == 1
        exported.close()

    async def test_export_nonexistent_session(self, export_client: AsyncClient):
        resp = await export_client.post(
            "/api/export/nonexistent",
            json={"annotations": {}, "options": {}},
        )
        assert resp.status_code == 404
