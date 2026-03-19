"""
Mudbrick v2 -- Test Configuration and Fixtures (Desktop)
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def tmp_data_dir(tmp_path: Path) -> Path:
    """Provide a temporary directory for test session data."""
    data_dir = tmp_path / "mudbrick_test"
    data_dir.mkdir()
    # Point config to temp dir
    os.environ["MUDBRICK_DATA_DIR"] = str(data_dir)
    return data_dir


@pytest.fixture
def session_manager(tmp_data_dir: Path):
    """Create a SessionManager with temp directory storage."""
    from app.services.session_manager import SessionManager

    sessions_dir = tmp_data_dir / "sessions"
    sessions_dir.mkdir()
    return SessionManager(sessions_dir=sessions_dir)


@pytest.fixture
async def client(tmp_data_dir: Path):
    """Create a test HTTP client for the FastAPI app."""
    # Reset singleton session manager to pick up temp directory
    from app.dependencies import reset_session_manager

    reset_session_manager()

    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    reset_session_manager()


@pytest.fixture
def sample_pdf_bytes() -> bytes:
    """Return a minimal valid PDF for testing."""
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R "
        b"/MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n196\n%%EOF\n"
    )


@pytest.fixture
def sample_pdf_file(tmp_path: Path, sample_pdf_bytes: bytes) -> Path:
    """Write a minimal PDF to a temp file and return its path."""
    pdf_path = tmp_path / "test.pdf"
    pdf_path.write_bytes(sample_pdf_bytes)
    return pdf_path
