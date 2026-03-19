"""
Mudbrick v2 -- Merge Router

Combine multiple PDFs into one session.
"""

from __future__ import annotations

from typing import List

import fitz
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from ..dependencies import get_session_manager
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager
from ..utils.file_handling import is_valid_pdf

router = APIRouter(prefix="/api/merge", tags=["merge"])


class MergeResponse:
    pass


@router.post("")
async def merge_documents(
    files: List[UploadFile] = File(...),
    sm: SessionManager = Depends(get_session_manager),
):
    """Merge multiple uploaded PDFs into a single document.

    Files are merged in the order they are uploaded.
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 files required for merge")

    docs: list[fitz.Document] = []
    try:
        for f in files:
            data = await f.read()
            if not is_valid_pdf(data):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid PDF file: {f.filename}",
                )
            try:
                doc = PdfEngine.open_from_bytes(data)
                docs.append(doc)
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot open PDF {f.filename}: {str(e)}",
                )

        merged = PdfEngine.merge_documents(docs)
        merged_bytes = PdfEngine.save_to_bytes(merged)
        page_count = merged.page_count
        merged.close()

    finally:
        for doc in docs:
            doc.close()

    # Create a new session with the merged PDF
    file_names = [f.filename or "unknown.pdf" for f in files]
    merged_name = f"merged_{'_'.join(n.replace('.pdf', '') for n in file_names[:3])}.pdf"

    meta = await sm.create_session(merged_bytes, merged_name)
    await sm.update_metadata(meta.session_id, page_count=page_count)

    return {
        "session_id": meta.session_id,
        "page_count": page_count,
    }
