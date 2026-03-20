"""
Mudbrick v2 -- Merge Router (Desktop / Local Filesystem)

Combine multiple PDFs by local file paths into one session.
No HTTP upload -- backend reads files directly from disk.
"""

from __future__ import annotations

from pathlib import Path

import fitz
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..dependencies import get_session_manager
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/merge", tags=["merge"])


class MergeRequest(BaseModel):
    """Request to merge multiple PDFs by local file paths."""

    file_paths: list[str]


class MergeResponse(BaseModel):
    session_id: str
    page_count: int


@router.post("", response_model=MergeResponse)
async def merge_documents(
    request: MergeRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Merge multiple local PDF files into a single document.

    Files are merged in the order given. Backend reads directly from disk.
    """
    if len(request.file_paths) < 2:
        raise HTTPException(status_code=400, detail="At least 2 files required for merge")

    docs: list[fitz.Document] = []
    try:
        for fp in request.file_paths:
            source = Path(fp)
            if not source.exists():
                raise HTTPException(status_code=404, detail=f"File not found: {fp}")
            if not source.is_file():
                raise HTTPException(status_code=400, detail=f"Not a file: {fp}")

            try:
                doc = PdfEngine.open_from_file(str(source))
                docs.append(doc)
            except FileNotFoundError:
                raise HTTPException(status_code=404, detail=f"File not found: {fp}")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Cannot open {fp}: {str(e)}")

        merged = PdfEngine.merge_documents(docs)
        merged_bytes = PdfEngine.save_to_bytes(merged)
        page_count = merged.page_count
        merged.close()

    finally:
        for doc in docs:
            doc.close()

    names = [Path(fp).stem for fp in request.file_paths[:3]]
    merged_name = f"merged_{'_'.join(names)}.pdf"
    meta = sm.create_session_from_bytes(
        file_name=merged_name,
        pdf_bytes=merged_bytes,
        operation="merge documents",
    )
    sm.update_metadata(meta.session_id, page_count=page_count)

    return MergeResponse(session_id=meta.session_id, page_count=page_count)
