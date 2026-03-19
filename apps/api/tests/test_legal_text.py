"""
Mudbrick v2 -- Tests for Bates numbering and headers/footers routers
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
def legal_session_mgr(tmp_path: Path) -> SessionManager:
    sessions_dir = tmp_path / "sessions"
    sessions_dir.mkdir()
    return SessionManager(sessions_dir=sessions_dir)


@pytest.fixture
async def legal_client(legal_session_mgr: SessionManager):
    app.dependency_overrides[get_session_manager] = lambda: legal_session_mgr
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def legal_pdf_file(tmp_path: Path) -> Path:
    doc = fitz.open()
    for index in range(3):
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 100), f"Legal page {index + 1}", fontsize=16)
    pdf_path = tmp_path / "legal.pdf"
    doc.save(str(pdf_path))
    doc.close()
    return pdf_path


async def open_file(client: AsyncClient, file_path: Path) -> str:
    response = await client.post("/api/documents/open", json={"file_path": str(file_path)})
    assert response.status_code == 200
    return response.json()["session_id"]


def get_page_texts(sm: SessionManager, sid: str) -> list[str]:
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    assert pdf_bytes is not None
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        return [doc[index].get_text("text") for index in range(doc.page_count)]
    finally:
        doc.close()


@pytest.mark.asyncio
class TestLegalTextRoutes:
    async def test_apply_bates_numbers(
        self,
        legal_client: AsyncClient,
        legal_session_mgr: SessionManager,
        legal_pdf_file: Path,
    ):
        sid = await open_file(legal_client, legal_pdf_file)

        response = await legal_client.post(
            f"/api/bates/{sid}",
            json={
                "prefix": "MB-",
                "start_num": 7,
                "zero_pad": 4,
                "position": "bottom-right",
                "font_size": 11,
                "color": "#000000",
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["first_label"] == "MB-0007"
        assert payload["last_label"] == "MB-0009"

        page_texts = get_page_texts(legal_session_mgr, sid)
        assert "MB-0007" in page_texts[0]
        assert "MB-0008" in page_texts[1]
        assert "MB-0009" in page_texts[2]

    async def test_apply_headers_and_footers_with_tokens(
        self,
        legal_client: AsyncClient,
        legal_session_mgr: SessionManager,
        legal_pdf_file: Path,
    ):
        sid = await open_file(legal_client, legal_pdf_file)

        response = await legal_client.post(
            f"/api/headers/{sid}",
            json={
                "top_left": "CONFIDENTIAL",
                "bottom_right": "{page}/{pages}",
                "font_size": 10,
                "font": "TimesRoman",
                "margin": 0.5,
                "filename": "legal.pdf",
            },
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        page_texts = get_page_texts(legal_session_mgr, sid)
        assert "CONFIDENTIAL" in page_texts[0]
        assert "1/3" in page_texts[0]
        assert "2/3" in page_texts[1]
        assert "3/3" in page_texts[2]

    async def test_headers_skip_first_page(
        self,
        legal_client: AsyncClient,
        legal_session_mgr: SessionManager,
        legal_pdf_file: Path,
    ):
        sid = await open_file(legal_client, legal_pdf_file)

        response = await legal_client.post(
            f"/api/headers/{sid}",
            json={
                "top_center": "DRAFT",
                "skip_first": True,
            },
        )

        assert response.status_code == 200

        page_texts = get_page_texts(legal_session_mgr, sid)
        assert "DRAFT" not in page_texts[0]
        assert "DRAFT" in page_texts[1]
        assert "DRAFT" in page_texts[2]
