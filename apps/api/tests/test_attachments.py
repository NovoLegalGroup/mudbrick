"""
Mudbrick v2 -- Attachment Router Tests
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
def attachment_pdf(tmp_path: Path) -> Path:
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), "Attachment test", fontsize=14)
    pdf_path = tmp_path / "attachment-test.pdf"
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


@pytest.fixture
def attachment_file(tmp_path: Path) -> Path:
    file_path = tmp_path / "notes.txt"
    file_path.write_text("Attachment contents", encoding="utf-8")
    return file_path


@pytest.fixture
def attachment_session_mgr(tmp_path: Path) -> SessionManager:
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()
    return SessionManager(sessions_dir=sessions_dir)


@pytest.fixture
async def attachment_client(attachment_session_mgr: SessionManager):
    app.dependency_overrides[get_session_manager] = lambda: attachment_session_mgr
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


async def _open_session(client: AsyncClient, pdf_path: Path) -> str:
    response = await client.post("/api/documents/open", json={"file_path": str(pdf_path)})
    assert response.status_code == 200
    return response.json()["session_id"]


@pytest.mark.asyncio
async def test_list_empty_attachments(
    attachment_client: AsyncClient,
    attachment_pdf: Path,
):
    sid = await _open_session(attachment_client, attachment_pdf)

    response = await attachment_client.get(f"/api/attachments/{sid}")
    assert response.status_code == 200
    assert response.json()["attachments"] == []
    assert response.json()["total"] == 0


@pytest.mark.asyncio
async def test_add_and_list_attachments(
    attachment_client: AsyncClient,
    attachment_pdf: Path,
    attachment_file: Path,
):
    sid = await _open_session(attachment_client, attachment_pdf)

    add_response = await attachment_client.post(
        f"/api/attachments/{sid}/add",
        json={"file_paths": [str(attachment_file)]},
    )
    assert add_response.status_code == 200
    assert add_response.json()["attachments_added"] == 1

    list_response = await attachment_client.get(f"/api/attachments/{sid}")
    data = list_response.json()
    assert list_response.status_code == 200
    assert data["total"] == 1
    assert data["attachments"][0]["file_name"] == "notes.txt"


@pytest.mark.asyncio
async def test_export_attachment(
    attachment_client: AsyncClient,
    attachment_pdf: Path,
    attachment_file: Path,
    tmp_path: Path,
):
    sid = await _open_session(attachment_client, attachment_pdf)

    await attachment_client.post(
        f"/api/attachments/{sid}/add",
        json={"file_paths": [str(attachment_file)]},
    )

    export_path = tmp_path / "exported" / "notes.txt"
    export_response = await attachment_client.post(
        f"/api/attachments/{sid}/export",
        json={"name": "notes.txt", "output_path": str(export_path)},
    )
    assert export_response.status_code == 200
    assert export_path.exists()
    assert export_path.read_text(encoding="utf-8") == "Attachment contents"


@pytest.mark.asyncio
async def test_delete_attachment(
    attachment_client: AsyncClient,
    attachment_pdf: Path,
    attachment_file: Path,
):
    sid = await _open_session(attachment_client, attachment_pdf)

    await attachment_client.post(
        f"/api/attachments/{sid}/add",
        json={"file_paths": [str(attachment_file)]},
    )

    delete_response = await attachment_client.request(
        "DELETE",
        f"/api/attachments/{sid}",
        json={"name": "notes.txt"},
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["total_attachments"] == 0

    list_response = await attachment_client.get(f"/api/attachments/{sid}")
    assert list_response.json()["attachments"] == []
