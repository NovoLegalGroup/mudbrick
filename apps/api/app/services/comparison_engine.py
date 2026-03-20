"""
Mudbrick v2 -- Document Comparison Engine

Page-level diff: render each page of both PDFs as images via PyMuPDF,
compare pixel data using Pillow (ImageChops.difference), identify
added/deleted/modified pages.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import fitz  # PyMuPDF

try:
    from PIL import Image, ImageChops, ImageStat
except ImportError:
    Image = None  # type: ignore[assignment,misc]
    ImageChops = None  # type: ignore[assignment,misc]
    ImageStat = None  # type: ignore[assignment,misc]

from .pdf_engine import PdfEngine


class ChangeType(str, Enum):
    ADDED = "added"
    DELETED = "deleted"
    MODIFIED = "modified"
    UNCHANGED = "unchanged"


@dataclass
class PageChange:
    """Represents a change detected on a single page."""

    page: int  # 1-indexed page number
    type: ChangeType
    diff_score: float = 0.0  # 0.0 = identical, 1.0 = completely different
    diff_image_bytes: Optional[bytes] = None  # PNG diff image (if modified)


@dataclass
class ComparisonSummary:
    """Summary of differences between two documents."""

    added: int = 0
    deleted: int = 0
    modified: int = 0
    unchanged: int = 0


@dataclass
class ComparisonResult:
    """Full comparison result."""

    changes: list[PageChange] = field(default_factory=list)
    summary: ComparisonSummary = field(default_factory=ComparisonSummary)


# Pixel difference threshold: compare using both mean and RMS so sparse text
# edits still register as modified pages.
_DIFF_THRESHOLD = 0.01


def _render_page_to_pil(doc: fitz.Document, page_idx: int, dpi: int = 150) -> "Image.Image":
    """Render a PDF page to a Pillow Image."""
    image_bytes = PdfEngine.render_page_to_image(doc, page_idx, dpi=dpi, alpha=False, image_format="png")
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


def _compute_diff_score(img1: "Image.Image", img2: "Image.Image") -> tuple[float, bytes]:
    """Compute pixel difference between two images. Returns (score, diff_png_bytes)."""
    # Resize to same dimensions if needed
    if img1.size != img2.size:
        target = (max(img1.width, img2.width), max(img1.height, img2.height))
        img1 = img1.resize(target, Image.LANCZOS)
        img2 = img2.resize(target, Image.LANCZOS)

    diff = ImageChops.difference(img1, img2)
    stat = ImageStat.Stat(diff)

    # Mean and RMS across R, G, B channels normalized to 0-1. Mean alone is
    # too forgiving for sparse edits like single-line text changes on a mostly
    # white page, so we keep the more sensitive of the two.
    mean_diff = sum(stat.mean) / (3 * 255.0)
    rms_diff = sum(stat.rms) / (3 * 255.0)
    diff_score = max(mean_diff, rms_diff)

    # Encode diff image as PNG
    buf = io.BytesIO()
    diff.save(buf, format="PNG")
    diff_bytes = buf.getvalue()

    return diff_score, diff_bytes


def compare_documents(
    path_1: str,
    path_2: str,
    dpi: int = 150,
    include_diff_images: bool = True,
) -> ComparisonResult:
    """Compare two PDF documents page by page.

    Args:
        path_1: Path to the first (original) PDF.
        path_2: Path to the second (comparison) PDF.
        dpi: Resolution for page rendering (higher = more accurate, slower).
        include_diff_images: Whether to include diff image bytes in results.

    Returns:
        ComparisonResult with per-page changes and summary counts.
    """
    if Image is None:
        raise RuntimeError("Pillow is required for document comparison. Install with: pip install Pillow")

    doc1 = PdfEngine.open_from_file(path_1)
    doc2 = PdfEngine.open_from_file(path_2)

    try:
        count1 = doc1.page_count
        count2 = doc2.page_count
        max_pages = max(count1, count2)

        changes: list[PageChange] = []
        summary = ComparisonSummary()

        for i in range(max_pages):
            page_num = i + 1  # 1-indexed

            if i >= count1:
                # Page exists only in doc2 -> added
                changes.append(PageChange(page=page_num, type=ChangeType.ADDED, diff_score=1.0))
                summary.added += 1
            elif i >= count2:
                # Page exists only in doc1 -> deleted
                changes.append(PageChange(page=page_num, type=ChangeType.DELETED, diff_score=1.0))
                summary.deleted += 1
            else:
                # Both docs have this page -> compare pixels
                img1 = _render_page_to_pil(doc1, i, dpi=dpi)
                img2 = _render_page_to_pil(doc2, i, dpi=dpi)

                score, diff_bytes = _compute_diff_score(img1, img2)

                if score < _DIFF_THRESHOLD:
                    changes.append(PageChange(page=page_num, type=ChangeType.UNCHANGED, diff_score=score))
                    summary.unchanged += 1
                else:
                    changes.append(PageChange(
                        page=page_num,
                        type=ChangeType.MODIFIED,
                        diff_score=round(score, 4),
                        diff_image_bytes=diff_bytes if include_diff_images else None,
                    ))
                    summary.modified += 1

        return ComparisonResult(changes=changes, summary=summary)

    finally:
        doc1.close()
        doc2.close()
