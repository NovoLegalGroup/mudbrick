"""
Mudbrick v2 -- Thumbnail Router

Generate page thumbnails via PyMuPDF.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from ..dependencies import get_session_manager
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/pages", tags=["thumbnails"])


@router.get("/{sid}/{page}/thumbnail")
async def get_page_thumbnail(
    sid: str,
    page: int,
    width: int = Query(default=200, ge=50, le=800),
    sm: SessionManager = Depends(get_session_manager),
):
    """Render a page thumbnail at the specified width.

    Page numbers are 1-indexed.
    """
    # Check if cached thumbnail exists
    cache_key = f"sessions/{sid}/thumbnails/page_{page}_w{width}.png"
    cached = await sm.blob.get(cache_key)
    if cached:
        return Response(content=cached, media_type="image/png")

    # Generate thumbnail
    pdf_bytes = await sm.get_current_pdf(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_bytes(pdf_bytes)
    try:
        if page < 1 or page > doc.page_count:
            raise HTTPException(
                status_code=400,
                detail=f"Page {page} out of range (1-{doc.page_count})",
            )
        png_bytes = PdfEngine.render_thumbnail(doc, page - 1, width=width)
    finally:
        doc.close()

    # Cache the thumbnail
    await sm.blob.put(cache_key, png_bytes, "image/png")

    return Response(content=png_bytes, media_type="image/png")
