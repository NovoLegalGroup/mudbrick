"""
Mudbrick v2 -- Export Router

Flatten annotations onto PDF and produce final export.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_session_manager
from ..models.annotation import ExportRequest, ExportResponse
from ..services.annotation_renderer import render_annotations_to_page
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/export", tags=["export"])


@router.post("/{sid}", response_model=ExportResponse)
async def export_document(
    sid: str,
    request: ExportRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Export the document with annotations flattened onto it.

    Annotations are Fabric.js JSON objects keyed by page number (1-indexed string).
    The server renders each annotation onto the corresponding PDF page using PyMuPDF,
    saves the result, and returns a download URL.
    """
    pdf_bytes = await sm.get_current_pdf(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        for page_str, annotation_set in request.annotations.items():
            page_num = int(page_str) - 1  # Convert to 0-indexed
            if page_num < 0 or page_num >= doc.page_count:
                continue

            page = doc[page_num]
            objects = annotation_set.objects

            if not objects:
                continue

            # Determine the CSS pixel dimensions the annotations were drawn at.
            # Use options if provided, otherwise use page dimensions at 1.0 scale.
            page_width = request.options.get(
                "page_width", page.rect.width
            )
            page_height = request.options.get(
                "page_height", page.rect.height
            )

            render_annotations_to_page(
                page, objects, page_width, page_height
            )

        export_bytes = PdfEngine.save_to_bytes(doc)
    finally:
        doc.close()

    # Store the export and return a download URL
    export_key = f"sessions/{sid}/export.pdf"
    await sm.blob.put(export_key, export_bytes, "application/pdf")

    # In local dev, we return a path that the download endpoint can serve.
    # In production, this would be a presigned Blob URL.
    download_url = f"/api/documents/{sid}/download"

    # Update the current PDF to be the exported version
    # (This way the download endpoint serves the exported PDF)
    await sm.blob.put(f"sessions/{sid}/current.pdf", export_bytes, "application/pdf")

    return ExportResponse(download_url=download_url)
