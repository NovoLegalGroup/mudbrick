"""
Mudbrick v2 -- Tests for Export Router
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest
from httpx import AsyncClient


async def open_file(client: AsyncClient, file_path: Path) -> str:
    response = await client.post(
        "/api/documents/open",
        json={"file_path": str(file_path)},
    )
    assert response.status_code == 200
    return response.json()["session_id"]


@pytest.mark.asyncio
class TestExport:
    async def test_export_no_annotations(
        self,
        client: AsyncClient,
        sample_pdf_file: Path,
    ):
        sid = await open_file(client, sample_pdf_file)
        response = await client.post(
            f"/api/export/{sid}",
            json={"annotations": {}, "options": {}},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["file_path"] == str(sample_pdf_file)

    async def test_export_with_annotations_to_output_path(
        self,
        client: AsyncClient,
        sample_pdf_file: Path,
        tmp_path: Path,
    ):
        sid = await open_file(client, sample_pdf_file)
        output_path = tmp_path / "exported.pdf"

        response = await client.post(
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
                "output_path": str(output_path),
                "options": {"page_width": 612, "page_height": 792},
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True
        assert payload["file_path"] == str(output_path)
        assert output_path.exists()

        exported = fitz.open(str(output_path))
        assert exported.page_count == 1
        exported.close()

    async def test_export_nonexistent_session(self, client: AsyncClient):
        response = await client.post(
            "/api/export/nonexistent",
            json={"annotations": {}, "options": {}},
        )
        assert response.status_code == 404
