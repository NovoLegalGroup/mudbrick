"""
Mudbrick v2 -- Bates Numbering Router
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_session_manager
from ..services.legal_text import BatesOptions, apply_bates_numbers
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/bates", tags=["bates"])


class BatesRequest(BaseModel):
    prefix: str = ""
    suffix: str = ""
    start_num: int = 1
    zero_pad: int = 6
    position: str = "bottom-center"
    font: str = "Helvetica"
    font_size: float = 10
    color: str = "#000000"
    start_page: int = 1
    end_page: int = 0
    margin: float = Field(default=0.5, description="Margin in inches")


class BatesResponse(BaseModel):
    success: bool = True
    first_label: str = ""
    last_label: str = ""
    page_count: int


@router.post("/{sid}", response_model=BatesResponse)
async def apply_bates(
    sid: str,
    request: BatesRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        try:
            first_label, last_label = apply_bates_numbers(
                doc,
                BatesOptions(**request.model_dump()),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        new_bytes = PdfEngine.save_to_bytes(doc)
        page_count = doc.page_count
    finally:
        doc.close()

    sm.save_current_pdf(sid, new_bytes, "apply bates numbers")

    return BatesResponse(
        first_label=first_label,
        last_label=last_label,
        page_count=page_count,
    )
