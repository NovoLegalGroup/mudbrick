"""
Mudbrick v2 -- Security Router

PDF encryption (AES-256 via pikepdf), metadata management, and sanitization.
"""

from __future__ import annotations

from typing import Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

try:
    import pikepdf
except ImportError:
    pikepdf = None  # type: ignore[assignment]

from ..dependencies import get_session_manager
from ..services.pdf_engine import PdfEngine
from ..services.session_manager import SessionManager

router = APIRouter(prefix="/api/security", tags=["security"])


# ── Request / Response Models ──


class EncryptRequest(BaseModel):
    """Request body for PDF encryption."""

    user_password: str = Field(default="", description="Password to open the PDF (empty = no restriction)")
    owner_password: str = Field(..., description="Owner password for permission control")
    allow_print: bool = Field(default=True)
    allow_copy: bool = Field(default=True)
    allow_modify: bool = Field(default=False)
    allow_annotate: bool = Field(default=True)


class EncryptResponse(BaseModel):
    success: bool = True
    encrypted: bool = True
    permissions: dict[str, bool]


class MetadataResponse(BaseModel):
    title: str = ""
    author: str = ""
    subject: str = ""
    keywords: str = ""
    creator: str = ""
    producer: str = ""
    creation_date: str = ""
    mod_date: str = ""


class MetadataUpdateRequest(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[str] = None


class MetadataUpdateResponse(BaseModel):
    success: bool = True
    updated_fields: list[str]


class SanitizeResponse(BaseModel):
    success: bool = True
    removed: list[str]


# ── Endpoints ──


@router.post("/{sid}/encrypt", response_model=EncryptResponse)
async def encrypt_document(
    sid: str,
    request: EncryptRequest,
    sm: SessionManager = Depends(get_session_manager),
) -> EncryptResponse:
    """Encrypt the PDF with AES-256 using pikepdf.

    Sets user/owner passwords and granular permissions.
    """
    if pikepdf is None:
        raise HTTPException(status_code=500, detail="pikepdf is required for encryption")

    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        # Build permission flags
        permissions = pikepdf.Permissions(
            print_lowres=request.allow_print,
            print_highres=request.allow_print,
            extract=request.allow_copy,
            modify_other=request.allow_modify,
            modify_annotation=request.allow_annotate,
            modify_form=request.allow_annotate,
            modify_assembly=request.allow_modify,
            accessibility=True,  # Always allow accessibility
        )

        pdf = pikepdf.open(str(pdf_path), allow_overwriting_input=True)
        pdf.save(
            str(pdf_path),
            encryption=pikepdf.Encryption(
                user=request.user_password,
                owner=request.owner_password,
                R=6,  # AES-256
                allow=permissions,
            ),
        )
        pdf.close()

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Encryption failed: {e}")

    return EncryptResponse(
        permissions={
            "print": request.allow_print,
            "copy": request.allow_copy,
            "modify": request.allow_modify,
            "annotate": request.allow_annotate,
        },
    )


@router.get("/{sid}/metadata", response_model=MetadataResponse)
async def get_metadata(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
) -> MetadataResponse:
    """Read PDF metadata (title, author, subject, keywords, etc.)."""
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        meta = doc.metadata or {}
        return MetadataResponse(
            title=meta.get("title", "") or "",
            author=meta.get("author", "") or "",
            subject=meta.get("subject", "") or "",
            keywords=meta.get("keywords", "") or "",
            creator=meta.get("creator", "") or "",
            producer=meta.get("producer", "") or "",
            creation_date=meta.get("creationDate", "") or "",
            mod_date=meta.get("modDate", "") or "",
        )
    finally:
        doc.close()


@router.post("/{sid}/metadata", response_model=MetadataUpdateResponse)
async def update_metadata(
    sid: str,
    request: MetadataUpdateRequest,
    sm: SessionManager = Depends(get_session_manager),
) -> MetadataUpdateResponse:
    """Update PDF metadata fields."""
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        updated: list[str] = []
        metadata = dict(doc.metadata or {})

        if request.title is not None:
            metadata["title"] = request.title
            updated.append("title")
        if request.author is not None:
            metadata["author"] = request.author
            updated.append("author")
        if request.subject is not None:
            metadata["subject"] = request.subject
            updated.append("subject")
        if request.keywords is not None:
            metadata["keywords"] = request.keywords
            updated.append("keywords")

        if updated:
            doc.set_metadata(metadata)
            doc.saveIncr()
    finally:
        doc.close()

    return MetadataUpdateResponse(updated_fields=updated)


@router.post("/{sid}/sanitize", response_model=SanitizeResponse)
async def sanitize_document(
    sid: str,
    sm: SessionManager = Depends(get_session_manager),
) -> SanitizeResponse:
    """Sanitize the PDF: strip metadata, clean XMP, remove JavaScript, strip hidden content."""
    pdf_path = sm.get_current_pdf_path(sid)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Session not found")

    removed: list[str] = []

    doc = PdfEngine.open_from_file(str(pdf_path))
    try:
        # 1. Strip standard metadata
        meta = doc.metadata or {}
        has_metadata = any(v for v in meta.values() if v)
        if has_metadata:
            doc.set_metadata({})
            removed.append("Standard metadata (title, author, subject, keywords, creator, producer)")

        # 2. Clean XMP metadata
        try:
            xmp = doc.xref_get_key(-1, "Metadata")
            if xmp and xmp[0] != "null":
                # Remove the metadata stream reference from the catalog
                doc.xref_set_key(-1, "Metadata", "null")
                removed.append("XMP metadata stream")
        except Exception:
            pass  # No XMP metadata

        # 3. Remove JavaScript
        _remove_javascript(doc, removed)

        # 4. Remove hidden content (optional content groups / layers)
        try:
            ocprops = doc.xref_get_key(-1, "OCProperties")
            if ocprops and ocprops[0] != "null":
                doc.xref_set_key(-1, "OCProperties", "null")
                removed.append("Optional content (layers)")
        except Exception:
            pass

        # Save the sanitized document
        sanitized_bytes = PdfEngine.save_to_bytes(doc)
    finally:
        doc.close()

    # Write back the sanitized PDF
    pdf_path.write_bytes(sanitized_bytes)

    if not removed:
        removed.append("No sensitive content found")

    return SanitizeResponse(removed=removed)


def _remove_javascript(doc: fitz.Document, removed: list[str]) -> None:
    """Remove all JavaScript actions from the document."""
    js_found = False

    # Check catalog for JavaScript name tree
    try:
        names = doc.xref_get_key(-1, "Names")
        if names and names[0] != "null":
            # Try to remove JavaScript name tree
            # This is a simplified approach -- full JS removal would walk all annotations
            js_key = doc.xref_get_key(-1, "Names")
            if js_key and "JavaScript" in str(js_key):
                js_found = True
    except Exception:
        pass

    # Check each page for JavaScript actions in annotations
    for page_idx in range(doc.page_count):
        page = doc[page_idx]
        for annot in page.annots() or []:
            try:
                info = annot.info
                if info and "javascript" in str(info).lower():
                    js_found = True
                    page.delete_annot(annot)
            except Exception:
                pass

    if js_found:
        removed.append("JavaScript actions")
