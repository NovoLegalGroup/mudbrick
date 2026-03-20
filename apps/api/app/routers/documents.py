"""
Mudbrick v2 -- Document Router (Desktop / Local Filesystem)

Open file by path, save, save-as, close session, get info, undo/redo.
No HTTP upload -- backend reads files directly from disk.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response

from ..dependencies import get_session_manager
from ..models.document import (
    CreateFromImagesRequest,
    OpenFileRequest,
    OptimizeResponse,
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


@router.post("/from-images", response_model=SessionCreateResponse)
async def create_document_from_images(
    request: CreateFromImagesRequest,
    sm: SessionManager = Depends(get_session_manager),
):
    """Create a new PDF session from one or more image files."""
    if not request.file_paths:
        raise HTTPException(status_code=400, detail="At least 1 image file is required")

    doc = None
    try:
        doc = PdfEngine.create_pdf_from_images(request.file_paths)
        page_count = doc.page_count
        pdf_bytes = PdfEngine.save_to_bytes(doc)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot create PDF from images: {str(e)}")
    finally:
        if doc is not None:
            doc.close()

    first_stem = Path(request.file_paths[0]).stem or "images"
    file_name = (
        f"{first_stem}.pdf"
        if len(request.file_paths) == 1
        else f"{first_stem}_images.pdf"
    )
    meta = sm.create_session_from_bytes(
        file_name=file_name,
        pdf_bytes=pdf_bytes,
        operation="create from images",
    )
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


@router.post("/{sid}/optimize", response_model=OptimizeResponse)
async def optimize_document(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
):
    """Optimize the current PDF for smaller file size when possible."""
    meta = sm.get_session(sid)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {sid}")

    pdf_bytes = sm.get_current_pdf_bytes(sid)
    if pdf_bytes is None:
        raise HTTPException(status_code=404, detail=f"Session not found: {sid}")

    doc = None
    try:
        doc = PdfEngine.open_from_bytes(pdf_bytes)
        optimized_bytes = PdfEngine.optimize_for_size(doc)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Optimization failed: {str(e)}")
    finally:
        if doc is not None:
            doc.close()

    original_size = len(pdf_bytes)
    optimized_size = len(optimized_bytes)
    bytes_saved = max(0, original_size - optimized_size)

    if bytes_saved > 0:
        new_version = sm.save_current_pdf(sid, optimized_bytes, "optimize pdf")
        return OptimizeResponse(
            optimized=True,
            page_count=meta.page_count,
            original_size=original_size,
            optimized_size=optimized_size,
            bytes_saved=bytes_saved,
            new_version=new_version,
        )

    return OptimizeResponse(
        optimized=False,
        page_count=meta.page_count,
        original_size=original_size,
        optimized_size=original_size,
        bytes_saved=0,
        new_version=None,
    )


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
