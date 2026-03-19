"""
Mudbrick v2 -- Merge Router (Desktop / Local Filesystem)

Combine multiple PDFs by local file paths into one session.
No HTTP upload -- backend reads files directly from disk.
"""

from __future__ import annotations

import os
import tempfile

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
            try:
                doc = PdfEngine.open_from_file(fp)
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

    # Create a new session -- write merged bytes to temp file, then open
    names = [os.path.splitext(os.path.basename(fp))[0] for fp in request.file_paths[:3]]
    merged_name = f"merged_{'_'.join(names)}.pdf"

    temp_path = os.path.join(tempfile.gettempdir(), f"mudbrick_merge_{merged_name}")
    with open(temp_path, "wb") as f:
        f.write(merged_bytes)

    try:
        meta = sm.open_file(temp_path)
        sm.update_metadata(meta.session_id, page_count=page_count, file_name=merged_name)
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass

    return MergeResponse(session_id=meta.session_id, page_count=page_count)
