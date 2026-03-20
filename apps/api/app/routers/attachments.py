"""
Mudbrick v2 -- Attachment Router

Manage embedded file attachments inside the current PDF session.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_session_manager
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/attachments", tags=["attachments"])


class AttachmentInfoResponse(BaseModel):
    name: str
    file_name: str
    description: str = ""
    size: int = 0
    creation_date: str = ""
    mod_date: str = ""


class AttachmentListResponse(BaseModel):
    attachments: list[AttachmentInfoResponse]
    total: int


class AttachmentAddRequest(BaseModel):
    file_paths: list[str] = Field(default_factory=list)


class AttachmentAddResponse(BaseModel):
    success: bool = True
    attachments_added: int
    attachment_names: list[str]
    total_attachments: int


class AttachmentExportRequest(BaseModel):
    name: str
    output_path: str


class AttachmentExportResponse(BaseModel):
    success: bool = True
    file_path: str


class AttachmentDeleteRequest(BaseModel):
    name: str


class AttachmentDeleteResponse(BaseModel):
    success: bool = True
    total_attachments: int


@router.get("/{sid}", response_model=AttachmentListResponse)
async def list_attachments(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
) -> AttachmentListResponse:
    """List embedded attachments in the current PDF."""
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        names = list(doc.embfile_names() or [])
        attachments = [
            _serialize_attachment(doc, name)
            for name in names
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read attachments: {str(e)}")
    finally:
        doc.close()

    return AttachmentListResponse(attachments=attachments, total=len(attachments))


@router.post("/{sid}/add", response_model=AttachmentAddResponse)
async def add_attachments(
    sid: str,
    request: AttachmentAddRequest,
    sm: SessionManager = Depends(get_session_manager),
) -> AttachmentAddResponse:
    """Embed one or more files into the current PDF."""
    if not request.file_paths:
        raise HTTPException(status_code=400, detail="At least 1 attachment file is required")

    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        existing_names = set(doc.embfile_names() or [])
        added_names: list[str] = []

        for file_path in request.file_paths:
            source = Path(file_path)
            if not source.exists():
                raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
            if not source.is_file():
                raise HTTPException(status_code=400, detail=f"Not a file: {file_path}")

            attachment_name = _dedupe_name(existing_names, source.name)
            _add_embedded_file(doc, attachment_name, source)
            existing_names.add(attachment_name)
            added_names.append(attachment_name)

        pdf_bytes = PdfEngine.save_to_bytes(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to add attachments: {str(e)}")
    finally:
        doc.close()

    sm.save_current_pdf(sid, pdf_bytes, "add attachments")
    return AttachmentAddResponse(
        attachments_added=len(added_names),
        attachment_names=added_names,
        total_attachments=len(existing_names),
    )


@router.post("/{sid}/export", response_model=AttachmentExportResponse)
async def export_attachment(
    sid: str,
    request: AttachmentExportRequest,
    sm: SessionManager = Depends(get_session_manager),
) -> AttachmentExportResponse:
    """Write an embedded attachment back to disk."""
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        names = set(doc.embfile_names() or [])
        if request.name not in names:
            raise HTTPException(status_code=404, detail=f"Attachment not found: {request.name}")
        data = doc.embfile_get(request.name)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to export attachment: {str(e)}")
    finally:
        doc.close()

    output_path = Path(request.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(data)
    return AttachmentExportResponse(file_path=str(output_path))


@router.delete("/{sid}", response_model=AttachmentDeleteResponse)
async def delete_attachment(
    sid: str,
    request: AttachmentDeleteRequest,
    sm: SessionManager = Depends(get_session_manager),
) -> AttachmentDeleteResponse:
    """Delete an embedded attachment from the current PDF."""
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        names = set(doc.embfile_names() or [])
        if request.name not in names:
            raise HTTPException(status_code=404, detail=f"Attachment not found: {request.name}")

        doc.embfile_del(request.name)
        remaining_total = max(0, len(names) - 1)
        pdf_bytes = PdfEngine.save_to_bytes(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to delete attachment: {str(e)}")
    finally:
        doc.close()

    sm.save_current_pdf(sid, pdf_bytes, "delete attachment")
    return AttachmentDeleteResponse(total_attachments=remaining_total)


def _serialize_attachment(doc, name: str) -> AttachmentInfoResponse:
    info = doc.embfile_info(name) or {}
    return AttachmentInfoResponse(
        name=name,
        file_name=(
            info.get("filename")
            or info.get("ufilename")
            or info.get("name")
            or name
        ),
        description=info.get("desc", "") or "",
        size=info.get("length") or info.get("size") or 0,
        creation_date=info.get("creationDate", "") or "",
        mod_date=info.get("modDate", "") or "",
    )


def _dedupe_name(existing_names: set[str], preferred_name: str) -> str:
    if preferred_name not in existing_names:
        return preferred_name

    source = Path(preferred_name)
    stem = source.stem or "attachment"
    suffix = source.suffix
    counter = 2
    while True:
        candidate = f"{stem} ({counter}){suffix}"
        if candidate not in existing_names:
            return candidate
        counter += 1


def _add_embedded_file(doc, attachment_name: str, source: Path) -> None:
    data = source.read_bytes()
    try:
        doc.embfile_add(
            attachment_name,
            data,
            filename=source.name,
            ufilename=source.name,
            desc="",
        )
    except TypeError:
        try:
            doc.embfile_add(attachment_name, data, source.name, source.name, "")
        except TypeError:
            doc.embfile_add(attachment_name, data, source.name)
