"""
Mudbrick v2 -- Page Operations Router (Desktop / Local Filesystem)

Rotate, delete, reorder, insert blank, crop pages.
Each operation works on local files and creates a new version.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..dependencies import get_session_manager
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/pages", tags=["pages"])


class RotateRequest(BaseModel):
    pages: list[int]  # 1-indexed page numbers
    degrees: int  # Must be multiple of 90


class DeleteRequest(BaseModel):
    pages: list[int]  # 1-indexed page numbers


class ReorderRequest(BaseModel):
    order: list[int]  # 1-indexed new page order


class InsertRequest(BaseModel):
    after: int = 0  # Insert after this page (1-indexed, 0 = at start)
    size: str = "letter"  # "letter" or "a4" or "legal"


class CropRequest(BaseModel):
    pages: list[int]  # 1-indexed
    box: dict  # {x, y, w, h} in points


class PageOperationResponse(BaseModel):
    success: bool = True
    page_count: int


PAGE_SIZES = {
    "letter": (612, 792),
    "a4": (595.28, 841.89),
    "legal": (612, 1008),
}


def _load_session_pdf(sm: SessionManager, sid: str) -> tuple[bytes, None]:
    """Load the current PDF bytes for a session, raising 404 if not found."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return pdf_bytes, None


@router.post("/{sid}/rotate", response_model=PageOperationResponse)
async def rotate_pages(
    sid: str,
    request: RotateRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Rotate specified pages by the given degrees."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        for page_num in request.pages:
            PdfEngine.rotate_page(doc, page_num - 1, request.degrees)
        new_bytes = PdfEngine.save_to_bytes(doc)
        page_count = doc.page_count
    finally:
        doc.close()

    sm.save_current_pdf(sid, new_bytes, f"rotate {request.degrees}deg")

    return PageOperationResponse(page_count=page_count)


@router.post("/{sid}/delete", response_model=PageOperationResponse)
async def delete_pages(
    sid: str,
    request: DeleteRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Delete specified pages from the document."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        if len(request.pages) >= doc.page_count:
            raise HTTPException(status_code=400, detail="Cannot delete all pages")

        # Delete in reverse order to maintain indices
        for page_num in sorted(request.pages, reverse=True):
            PdfEngine.delete_page(doc, page_num - 1)

        new_bytes = PdfEngine.save_to_bytes(doc)
        page_count = doc.page_count
    finally:
        doc.close()

    sm.save_current_pdf(sid, new_bytes, "delete pages")
    sm.update_metadata(sid, page_count=page_count)

    return PageOperationResponse(page_count=page_count)


@router.post("/{sid}/reorder", response_model=PageOperationResponse)
async def reorder_pages(
    sid: str,
    request: ReorderRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Reorder pages according to the given order."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        zero_indexed = [p - 1 for p in request.order]
        PdfEngine.reorder_pages(doc, zero_indexed)
        new_bytes = PdfEngine.save_to_bytes(doc)
        page_count = doc.page_count
    finally:
        doc.close()

    sm.save_current_pdf(sid, new_bytes, "reorder pages")

    return PageOperationResponse(page_count=page_count)


@router.post("/{sid}/insert", response_model=PageOperationResponse)
async def insert_blank_page(
    sid: str,
    request: InsertRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Insert a blank page after the specified page."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    width, height = PAGE_SIZES.get(request.size, PAGE_SIZES["letter"])

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        after_idx = request.after - 1 if request.after > 0 else -1
        PdfEngine.insert_blank_page(doc, after=after_idx, width=width, height=height)
        new_bytes = PdfEngine.save_to_bytes(doc)
        page_count = doc.page_count
    finally:
        doc.close()

    sm.save_current_pdf(sid, new_bytes, "insert blank page")
    sm.update_metadata(sid, page_count=page_count)

    return PageOperationResponse(page_count=page_count)


@router.post("/{sid}/crop", response_model=PageOperationResponse)
async def crop_pages(
    sid: str,
    request: CropRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Crop specified pages to the given bounding box."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        for page_num in request.pages:
            PdfEngine.crop_page(
                doc,
                page_num - 1,
                request.box["x"],
                request.box["y"],
                request.box["w"],
                request.box["h"],
            )
        new_bytes = PdfEngine.save_to_bytes(doc)
        page_count = doc.page_count
    finally:
        doc.close()

    sm.save_current_pdf(sid, new_bytes, "crop pages")

    return PageOperationResponse(page_count=page_count)
