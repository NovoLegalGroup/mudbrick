"""
Mudbrick v2 -- Thumbnail Router (Desktop / Local Filesystem)

Generate page thumbnails via PyMuPDF, cache on local disk.
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

    Page numbers are 1-indexed. Thumbnails are cached on local disk.
    """
    meta = sm.get_session(sid)
    if meta is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check local disk cache
    cached = sm.get_cached_thumbnail(sid, page, width)
    if cached:
        return Response(content=cached, media_type="image/png")

    # Generate thumbnail from PDF
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="PDF file not found")

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        if page < 1 or page > doc.page_count:
            raise HTTPException(
                status_code=400,
                detail=f"Page {page} out of range (1-{doc.page_count})",
            )
        png_bytes = PdfEngine.render_thumbnail(doc, page - 1, width=width)
    finally:
        doc.close()

    # Cache to local disk
    sm.cache_thumbnail(sid, page, width, png_bytes)

    return Response(content=png_bytes, media_type="image/png")
