"""
Mudbrick v2 -- Document Router (Desktop / Local Filesystem)

Open file by path, save, save-as, close session, get info, undo/redo.
No HTTP upload -- backend reads files directly from disk.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response

from ..dependencies import get_session_manager
from ..models.document import (
    OpenFileRequest,
    SaveRequest,
    SaveResponse,
    SessionCreateResponse,
    SessionInfoResponse,
    UndoRedoResponse,
)
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/open", response_model=SessionCreateResponse)
async def open_document(
    request: OpenFileRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Open a PDF file by local filesystem path.

    Backend reads the file directly from disk -- no upload, no network.
    """
    try:
        meta = sm.open_file(request.file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Validate PDF and get page count
    try:
        doc = PdfEngine.open_from_file(str(sm.get_current_pdf_path(meta.session_id)))
        page_count = doc.page_count
        doc.close()
    except Exception as e:
        # Clean up the session if PDF is invalid
        sm.close_session(meta.session_id)
        raise HTTPException(status_code=400, detail=f"Cannot open PDF: {str(e)}")

    meta = sm.update_metadata(meta.session_id, page_count=page_count)

    return SessionCreateResponse(
        session_id=meta.session_id,
        page_count=page_count,
        file_size=meta.file_size,
    )


@router.get("/{sid}", response_model=SessionInfoResponse)
async def get_document_info(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
):
    """Get session metadata and version history."""
    meta = sm.get_session(sid)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {sid}")

    versions = sm.get_versions(sid)

    return SessionInfoResponse(
        session_id=meta.session_id,
        file_path=meta.file_path,
        file_name=meta.file_name,
        file_size=meta.file_size,
        page_count=meta.page_count,
        current_version=meta.current_version,
        versions=versions,
        created_at=meta.created_at,
        updated_at=meta.updated_at,
    )


@router.get("/{sid}/pdf")
async def get_current_pdf(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
):
    """Return the current working PDF bytes for viewer reload/rendering."""
    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {sid}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Cache-Control": "no-store"},
    )


@router.post("/{sid}/save", response_model=SaveResponse)
async def save_document(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
):
    """Save the current document back to its original file path."""
    meta = sm.get_session(sid)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {sid}")

    try:
        file_path = sm.save_to_original(sid)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save: {str(e)}")

    return SaveResponse(file_path=file_path)


@router.post("/{sid}/save-as", response_model=SaveResponse)
async def save_document_as(
    sid: str,
    request: SaveRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Save the current document to a new file path."""
    meta = sm.get_session(sid)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {sid}")

    try:
        file_path = sm.save_as(sid, request.file_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save: {str(e)}")

    return SaveResponse(file_path=file_path)


@router.post("/{sid}/close")
async def close_document(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
):
    """Close a session and clean up all temp files."""
    meta = sm.get_session(sid)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {sid}")

    sm.close_session(sid)
    return {"success": True}


@router.post("/{sid}/undo", response_model=UndoRedoResponse)
async def undo_operation(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
):
    """Undo the last document operation."""
    result = sm.undo(sid)
    if result is None:
        raise HTTPException(status_code=400, detail="Nothing to undo")
    return result


@router.post("/{sid}/redo", response_model=UndoRedoResponse)
async def redo_operation(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
):
    """Redo the last undone operation."""
    result = sm.redo(sid)
    if result is None:
        raise HTTPException(status_code=400, detail="Nothing to redo")
    return result
