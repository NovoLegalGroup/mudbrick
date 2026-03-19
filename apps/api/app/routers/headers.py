"""
Mudbrick v2 -- Headers and Footers Router
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_session_manager
from ..services.legal_text import (
    HeaderFooterOptions,
    apply_headers_footers,
    default_filename_from_path,
)
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/headers", tags=["headers"])


class HeaderFooterRequest(BaseModel):
    top_left: str = ""
    top_center: str = ""
    top_right: str = ""
    bottom_left: str = ""
    bottom_center: str = ""
    bottom_right: str = ""
    font: str = "Helvetica"
    font_size: float = 10
    color: str = "#000000"
    margin: float = Field(default=0.5, description="Margin in inches")
    filename: str = ""
    start_page: int = 1
    end_page: int = 0
    skip_first: bool = False
    skip_last: bool = False
    mirror: bool = False
    draw_line: bool = False


class HeaderFooterResponse(BaseModel):
    success: bool = True
    page_count: int


@router.post("/{sid}", response_model=HeaderFooterResponse)
async def apply_headers(
    sid: str,
    request: HeaderFooterRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    meta = sm.get_session(sid)
    fallback_filename = default_filename_from_path(meta.file_path if meta else "")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        try:
            apply_headers_footers(
                doc,
                HeaderFooterOptions(**request.model_dump()),
                fallback_filename=fallback_filename,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        new_bytes = PdfEngine.save_to_bytes(doc)
        page_count = doc.page_count
    finally:
        doc.close()

    sm.save_current_pdf(sid, new_bytes, "apply headers and footers")

    return HeaderFooterResponse(page_count=page_count)
