"""
Mudbrick v2 -- Tests for image export endpoint
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
def export_session_mgr(tmp_path: Path) -> SessionManager:
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()
    return SessionManager(sessions_dir=sessions_dir)


@pytest.fixture
async def export_image_client(export_session_mgr: SessionManager):
    app.dependency_overrides[get_session_manager] = lambda: export_session_mgr
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def image_export_pdf_file(tmp_path: Path) -> Path:
    doc = fitz.open()
    for index in range(3):
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 72), f"Image export page {index + 1}", fontsize=18)
    pdf_path = tmp_path / "image-export.pdf"
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


async def open_file(client: AsyncClient, file_path: Path) -> str:
    response = await client.post("/api/documents/open", json={"file_path": str(file_path)})
    assert response.status_code == 200
    return response.json()["session_id"]


@pytest.mark.asyncio
class TestImageExport:
    async def test_export_selected_pages_as_png(
        self,
        export_image_client: AsyncClient,
        image_export_pdf_file: Path,
        tmp_path: Path,
    ):
        sid = await open_file(export_image_client, image_export_pdf_file)
        output_dir = tmp_path / "images"

        response = await export_image_client.post(
            f"/api/export/{sid}/images",
            json={
                "output_dir": str(output_dir),
                "format": "png",
                "dpi": 144,
                "pages": [1, 3],
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["exported_count"] == 2
        assert payload["format"] == "png"
        assert len(payload["file_paths"]) == 2

        for exported_path in payload["file_paths"]:
            path = Path(exported_path)
            assert path.exists()
            assert path.suffix.lower() == ".png"
            assert path.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"

    async def test_export_images_requires_valid_pages(
        self,
        export_image_client: AsyncClient,
        image_export_pdf_file: Path,
        tmp_path: Path,
    ):
        sid = await open_file(export_image_client, image_export_pdf_file)

        response = await export_image_client.post(
            f"/api/export/{sid}/images",
            json={
                "output_dir": str(tmp_path / "images"),
                "pages": [99],
            },
        )

        assert response.status_code == 400

    async def test_export_images_nonexistent_session(self, export_image_client: AsyncClient, tmp_path: Path):
        response = await export_image_client.post(
            "/api/export/nonexistent/images",
            json={"output_dir": str(tmp_path / "images")},
        )

        assert response.status_code == 404
