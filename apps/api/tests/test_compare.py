"""
Mudbrick v2 -- Tests for Document Comparison Router
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def two_page_pdf(tmp_path: Path) -> Path:
    """Create a 2-page PDF."""
    doc = fitz.open()
    page1 = doc.new_page(width=612, height=792)
    page1.insert_text((72, 72), "Page 1 - Original", fontsize=16)
    page2 = doc.new_page(width=612, height=792)
    page2.insert_text((72, 72), "Page 2 - Original", fontsize=16)
    path = tmp_path / "original.pdf"
    doc.save(str(path))
    doc.close()
    return path


@pytest.fixture
def modified_pdf(tmp_path: Path) -> Path:
    """Create a modified 2-page PDF (different text on page 1)."""
    doc = fitz.open()
    page1 = doc.new_page(width=612, height=792)
    page1.insert_text((72, 72), "Page 1 - MODIFIED TEXT HERE", fontsize=16)
    page2 = doc.new_page(width=612, height=792)
    page2.insert_text((72, 72), "Page 2 - Original", fontsize=16)
    path = tmp_path / "modified.pdf"
    doc.save(str(path))
    doc.close()
    return path


@pytest.fixture
def three_page_pdf(tmp_path: Path) -> Path:
    """Create a 3-page PDF (one page added)."""
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 72), f"Page {i + 1}", fontsize=16)
    path = tmp_path / "three_pages.pdf"
    doc.save(str(path))
    doc.close()
    return path


@pytest.fixture
async def compare_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_compare_identical(compare_client: AsyncClient, two_page_pdf: Path):
    """Comparing a file with itself should show all pages unchanged."""
    resp = await compare_client.post("/api/compare", json={
        "file_path_1": str(two_page_pdf),
        "file_path_2": str(two_page_pdf),
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["unchanged"] == 2
    assert data["summary"]["added"] == 0
    assert data["summary"]["deleted"] == 0
    assert data["summary"]["modified"] == 0
    assert len(data["changes"]) == 2


@pytest.mark.asyncio
async def test_compare_modified(compare_client: AsyncClient, two_page_pdf: Path, modified_pdf: Path):
    """Comparing original vs modified should detect the change."""
    resp = await compare_client.post("/api/compare", json={
        "file_path_1": str(two_page_pdf),
        "file_path_2": str(modified_pdf),
    })
    assert resp.status_code == 200
    data = resp.json()
    # Page 1 should be modified, page 2 unchanged
    assert data["changes"][0]["type"] == "modified"
    assert data["changes"][0]["diff_score"] > 0
    assert data["changes"][1]["type"] == "unchanged"


@pytest.mark.asyncio
async def test_compare_added_page(compare_client: AsyncClient, two_page_pdf: Path, three_page_pdf: Path):
    """Comparing 2-page vs 3-page PDF should show an added page."""
    resp = await compare_client.post("/api/compare", json={
        "file_path_1": str(two_page_pdf),
        "file_path_2": str(three_page_pdf),
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["added"] == 1
    # The 3rd page should be "added"
    page3 = [c for c in data["changes"] if c["page"] == 3]
    assert len(page3) == 1
    assert page3[0]["type"] == "added"


@pytest.mark.asyncio
async def test_compare_deleted_page(compare_client: AsyncClient, three_page_pdf: Path, two_page_pdf: Path):
    """Comparing 3-page vs 2-page PDF should show a deleted page."""
    resp = await compare_client.post("/api/compare", json={
        "file_path_1": str(three_page_pdf),
        "file_path_2": str(two_page_pdf),
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["deleted"] == 1


@pytest.mark.asyncio
async def test_compare_file_not_found(compare_client: AsyncClient, two_page_pdf: Path):
    """Should return 404 when a file doesn't exist."""
    resp = await compare_client.post("/api/compare", json={
        "file_path_1": str(two_page_pdf),
        "file_path_2": "/nonexistent/path.pdf",
    })
    assert resp.status_code == 404
