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


class ExportImagesRequest(BaseModel):
    """Request body for exporting PDF pages to image files."""

    output_dir: str
    format: str = Field(default="png", pattern="^(png|jpg|jpeg)$")
    dpi: int = Field(default=150, ge=72, le=600)
    pages: list[int] | None = Field(
        default=None,
        description="Specific 1-indexed pages to export. None = all pages.",
    )


class ExportImagesResponse(BaseModel):
    """Response from the image export endpoint."""

    success: bool = True
    output_dir: str
    format: str
    exported_count: int
    file_paths: list[str]


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


@router.post("/{sid}/images", response_model=ExportImagesResponse)
async def export_document_images(
    sid: str,
    request: ExportImagesRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Export PDF pages to individual image files in a local directory."""
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    output_dir = Path(request.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    meta = sm.get_session(sid)
    base_name = Path(meta.file_name).stem if meta else f"document_{sid}"
    format_name = "jpg" if request.format.lower() in {"jpg", "jpeg"} else "png"

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        if request.pages:
            page_numbers = list(
                dict.fromkeys(
                    page_num
                    for page_num in request.pages
                    if 1 <= page_num <= doc.page_count
                )
            )
        else:
            page_numbers = list(range(1, doc.page_count + 1))

        if not page_numbers:
            raise HTTPException(status_code=400, detail="No valid pages to export")

        file_paths: list[str] = []
        for page_num in page_numbers:
            image_bytes = PdfEngine.render_page_to_image(
                doc,
                page_num - 1,
                dpi=request.dpi,
                alpha=False,
                image_format=format_name,
            )
            output_path = output_dir / f"{base_name}_page_{page_num:03d}.{format_name}"
            output_path.write_bytes(image_bytes)
            file_paths.append(str(output_path))
    finally:
        doc.close()

    return ExportImagesResponse(
        output_dir=str(output_dir),
        format=format_name,
        exported_count=len(file_paths),
        file_paths=file_paths,
    )
