"""
Mudbrick v2 -- Document Comparison Router

POST /api/compare accepts two file paths and returns page-level diff results.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.comparison_engine import compare_documents, ChangeType

router = APIRouter(prefix="/api/compare", tags=["compare"])


class CompareRequest(BaseModel):
    """Request body for document comparison."""

    file_path_1: str = Field(..., description="Path to the original PDF")
    file_path_2: str = Field(..., description="Path to the comparison PDF")
    dpi: int = Field(default=150, ge=72, le=600, description="Rendering DPI for comparison")


class PageChangeResponse(BaseModel):
    """A single page change result."""

    page: int
    type: str  # "added" | "deleted" | "modified" | "unchanged"
    diff_score: float


class ComparisonSummaryResponse(BaseModel):
    """Summary counts of changes."""

    added: int
    deleted: int
    modified: int
    unchanged: int


class CompareResponse(BaseModel):
    """Response from the comparison endpoint."""

    changes: list[PageChangeResponse]
    summary: ComparisonSummaryResponse


@router.post("", response_model=CompareResponse)
async def compare_documents_endpoint(request: CompareRequest) -> CompareResponse:
    """Compare two PDF documents page by page.

    Returns per-page change type (added/deleted/modified/unchanged) with
    a diff score indicating the magnitude of change.
    """
    path1 = Path(request.file_path_1)
    path2 = Path(request.file_path_2)

    if not path1.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path_1}")
    if not path2.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path_2}")

    try:
        result = compare_documents(
            str(path1),
            str(path2),
            dpi=request.dpi,
            include_diff_images=False,  # Don't send image bytes over JSON
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Comparison failed: {e}")

    changes = [
        PageChangeResponse(
            page=c.page,
            type=c.type.value,
            diff_score=c.diff_score,
        )
        for c in result.changes
    ]

    summary = ComparisonSummaryResponse(
        added=result.summary.added,
        deleted=result.summary.deleted,
        modified=result.summary.modified,
        unchanged=result.summary.unchanged,
    )

    return CompareResponse(changes=changes, summary=summary)
