"""
Mudbrick v2 -- Export Router (Desktop / Local Filesystem)

Flatten annotations onto PDF and save to a local file path.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_session_manager
from ..models.annotation import AnnotationSet
from ..services.annotation_renderer import render_annotations_to_page
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/export", tags=["export"])


class ExportRequest(BaseModel):
    """Request body for the export endpoint."""

    annotations: dict[str, AnnotationSet] = Field(
        default_factory=dict,
        description="Page annotations keyed by page number (1-indexed string)",
    )
    output_path: str = ""  # Local file path to save to (optional)
    options: dict[str, Any] = Field(default_factory=dict)


class ExportResponse(BaseModel):
    """Response from the export endpoint."""

    success: bool = True
    file_path: str


@router.post("/{sid}", response_model=ExportResponse)
async def export_document(
    sid: str,
    request: ExportRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Export the document with annotations flattened onto it.

    Annotations are Fabric.js JSON objects keyed by page number (1-indexed string).
    The server renders each annotation onto the corresponding PDF page using PyMuPDF
    and saves the result to the specified output_path (or updates the session PDF).
    """
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        for page_str, annotation_set in request.annotations.items():
            page_num = int(page_str) - 1  # Convert to 0-indexed
            if page_num < 0 or page_num >= doc.page_count:
                continue

            page = doc[page_num]
            objects = annotation_set.objects

            if not objects:
                continue

            # Determine the CSS pixel dimensions the annotations were drawn at
            page_width = request.options.get("page_width", page.rect.width)
            page_height = request.options.get("page_height", page.rect.height)

            render_annotations_to_page(page, objects, page_width, page_height)

        export_bytes = PdfEngine.save_to_bytes(doc)
    finally:
        doc.close()

    # Save to the specified output path, or update the session's current PDF
    if request.output_path:
        output = Path(request.output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(export_bytes)
        file_path = str(output)
    else:
        # Update current session PDF with the exported version
        current = sm.get_current_pdf_path(sid)
        if current:
            current.write_bytes(export_bytes)
        meta = sm.get_session(sid)
        file_path = meta.file_path if meta else ""

    return ExportResponse(file_path=file_path)
