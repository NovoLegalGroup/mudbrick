"""
Mudbrick v2 -- Page Operations Router (Desktop / Local Filesystem)

Rotate, delete, reorder, insert blank, crop pages.
Each operation works on local files and creates a new version.
"""

from __future__ import annotations

from pathlib import Path

import fitz
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


class DuplicateRequest(BaseModel):
    pages: list[int]  # 1-indexed page numbers to duplicate in place


class InsertFromFileRequest(BaseModel):
    file_path: str
    after: int = 0  # Insert after this page (1-indexed, 0 = at start)
    pages: list[int] | None = None  # Optional 1-indexed pages from the source PDF


class ReplacePageRequest(BaseModel):
    page: int  # 1-indexed target page
    file_path: str
    source_page: int = 1  # 1-indexed for PDF sources


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


def _open_pdf_or_image(file_path: str) -> fitz.Document:
    source = Path(file_path)
    if not source.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    if not source.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {file_path}")

    suffix = source.suffix.lower()
    if suffix == ".pdf":
        return PdfEngine.open_from_file(str(source))
    if suffix in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif", ".webp"}:
        return PdfEngine.image_file_to_pdf(str(source))

    raise HTTPException(status_code=400, detail=f"Unsupported replacement source: {source.suffix}")


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


@router.post("/{sid}/duplicate", response_model=PageOperationResponse)
async def duplicate_pages(
    sid: str,
    request: DuplicateRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Duplicate the specified pages in place."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    duplicated_doc = None
    try:
        zero_indexed = sorted({page - 1 for page in request.pages if 1 <= page <= doc.page_count})
        if not zero_indexed:
            raise HTTPException(status_code=400, detail="No valid pages to duplicate")

        duplicated_doc = PdfEngine.duplicate_pages(doc, zero_indexed)
        new_bytes = PdfEngine.save_to_bytes(duplicated_doc)
        page_count = duplicated_doc.page_count
    finally:
        doc.close()
        if duplicated_doc is not None:
            duplicated_doc.close()

    sm.save_current_pdf(sid, new_bytes, "duplicate pages")
    sm.update_metadata(sid, page_count=page_count)

    return PageOperationResponse(page_count=page_count)


@router.post("/{sid}/insert-from-file", response_model=PageOperationResponse)
async def insert_pages_from_file(
    sid: str,
    request: InsertFromFileRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Insert pages from another PDF into the current document."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if Path(request.file_path).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files can be inserted")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    source_doc = None
    merged_doc = None
    try:
        source_doc = PdfEngine.open_from_file(request.file_path)
        after_idx = min(max(request.after - 1, -1), doc.page_count - 1)
        source_pages = None
        if request.pages:
            source_pages = [
                page - 1
                for page in sorted(set(request.pages))
                if 1 <= page <= source_doc.page_count
            ]
            if not source_pages:
                raise HTTPException(status_code=400, detail="No valid source pages to insert")

        merged_doc = PdfEngine.insert_pages(
            doc,
            source_doc,
            after=after_idx,
            source_pages=source_pages,
        )
        new_bytes = PdfEngine.save_to_bytes(merged_doc)
        page_count = merged_doc.page_count
    finally:
        doc.close()
        if source_doc is not None:
            source_doc.close()
        if merged_doc is not None:
            merged_doc.close()

    sm.save_current_pdf(sid, new_bytes, "insert pages from file")
    sm.update_metadata(sid, page_count=page_count)

    return PageOperationResponse(page_count=page_count)


@router.post("/{sid}/replace", response_model=PageOperationResponse)
async def replace_page(
    sid: str,
    request: ReplacePageRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Replace one page with a page from another PDF or an image file."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    source_doc = None
    replaced_doc = None
    try:
        if request.page < 1 or request.page > doc.page_count:
            raise HTTPException(status_code=400, detail="Target page out of range")

        source_doc = _open_pdf_or_image(request.file_path)
        source_page_idx = request.source_page - 1
        if source_page_idx < 0 or source_page_idx >= source_doc.page_count:
            raise HTTPException(status_code=400, detail="Source page out of range")

        replaced_doc = PdfEngine.replace_page(
            doc,
            request.page - 1,
            source_doc,
            replacement_page=source_page_idx,
        )
        new_bytes = PdfEngine.save_to_bytes(replaced_doc)
        page_count = replaced_doc.page_count
    finally:
        doc.close()
        if source_doc is not None:
            source_doc.close()
        if replaced_doc is not None:
            replaced_doc.close()

    sm.save_current_pdf(sid, new_bytes, "replace page")
    sm.update_metadata(sid, page_count=page_count)

    return PageOperationResponse(page_count=page_count)
