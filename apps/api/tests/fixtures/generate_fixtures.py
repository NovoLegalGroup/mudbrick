"""
Mudbrick v2 -- Test Fixture PDF Generator

Generates test PDF files programmatically using PyMuPDF for use in tests.
Run: python -m tests.fixtures.generate_fixtures

NOTE: Large fixtures (100MB+) are NOT committed to git.
To generate them locally, run this script with --large flag.
"""

from __future__ import annotations

import argparse
import base64
import io
import struct
import sys
import zlib
from pathlib import Path

import fitz


FIXTURES_DIR = Path(__file__).parent


def create_small_pdf() -> bytes:
    """Create a minimal 1-page PDF with simple text."""
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), "Mudbrick Test PDF - Small", fontsize=16)
    page.insert_text((72, 100), "This is a single-page test document.", fontsize=12)
    data = doc.tobytes()
    doc.close()
    return data


def create_multi_page_pdf(page_count: int = 10) -> bytes:
    """Create a multi-page PDF with text on each page."""
    doc = fitz.open()
    for i in range(page_count):
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 72), f"Page {i + 1} of {page_count}", fontsize=16)
        page.insert_text(
            (72, 100),
            f"This is page {i + 1}. Lorem ipsum dolor sit amet, "
            "consectetur adipiscing elit. Sed do eiusmod tempor incididunt "
            "ut labore et dolore magna aliqua.",
            fontsize=12,
        )
        # Add some variation to make pages distinguishable
        page.insert_text(
            (72, 140),
            f"Unique content for page {i + 1}: {'A' * (i + 1)}",
            fontsize=10,
        )
    data = doc.tobytes()
    doc.close()
    return data


def create_with_forms_pdf() -> bytes:
    """Create a PDF with form fields (text fields, checkboxes)."""
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 50), "PDF Form Test", fontsize=16)

    # Create a text widget (form field)
    widget = fitz.Widget()
    widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget.field_name = "name_field"
    widget.field_value = ""
    widget.rect = fitz.Rect(72, 80, 300, 100)
    page.add_widget(widget)

    # Create another text field
    widget2 = fitz.Widget()
    widget2.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget2.field_name = "email_field"
    widget2.field_value = ""
    widget2.rect = fitz.Rect(72, 120, 300, 140)
    page.add_widget(widget2)

    # Create a checkbox
    widget3 = fitz.Widget()
    widget3.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
    widget3.field_name = "agree_checkbox"
    widget3.field_value = "Off"
    widget3.rect = fitz.Rect(72, 160, 92, 180)
    page.add_widget(widget3)

    data = doc.tobytes()
    doc.close()
    return data


def create_with_annotations_pdf() -> bytes:
    """Create a PDF with existing annotations."""
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 72), "PDF with Annotations", fontsize=16)

    # Add a highlight annotation
    highlight_rect = fitz.Rect(72, 60, 300, 80)
    annot = page.add_highlight_annot(highlight_rect)
    annot.set_colors(stroke=(1, 1, 0))  # Yellow
    annot.update()

    # Add a text annotation (sticky note)
    text_annot = page.add_text_annot((400, 72), "This is a sticky note")
    text_annot.update()

    # Add a rectangle annotation
    rect_annot = page.add_rect_annot(fitz.Rect(72, 200, 200, 250))
    rect_annot.set_colors(stroke=(1, 0, 0))
    rect_annot.update()

    data = doc.tobytes()
    doc.close()
    return data


def _create_minimal_png(width: int = 100, height: int = 100) -> bytes:
    """Create a minimal gray PNG image in memory."""

    def make_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk = chunk_type + data
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)

    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    raw = b""
    for _ in range(height):
        raw += b"\x00" + b"\x80" * width
    idat_data = zlib.compress(raw)

    png = b"\x89PNG\r\n\x1a\n"
    png += make_chunk(b"IHDR", ihdr_data)
    png += make_chunk(b"IDAT", idat_data)
    png += make_chunk(b"IEND", b"")
    return png


def create_scanned_pdf() -> bytes:
    """Create an image-only PDF (no text layer) to simulate a scanned document."""
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)

    # Insert an image that fills most of the page (simulates a scan)
    img_bytes = _create_minimal_png(600, 780)
    img_rect = fitz.Rect(6, 6, 606, 786)
    page.insert_image(img_rect, stream=img_bytes)

    data = doc.tobytes()
    doc.close()
    return data


def create_large_pdf(target_mb: int = 100) -> bytes:
    """Create a large PDF for performance testing.

    WARNING: This generates a file of approximately target_mb megabytes.
    Do NOT commit this to git.
    """
    doc = fitz.open()
    page_count = 0
    # Estimate: each page with text is ~2-5KB, with images ~50-200KB
    # Use image pages to reach target size faster
    img_bytes = _create_minimal_png(800, 600)
    estimated_page_size = len(img_bytes) + 1000  # rough estimate
    target_bytes = target_mb * 1024 * 1024
    target_pages = max(10, target_bytes // estimated_page_size)

    for i in range(target_pages):
        page = doc.new_page(width=612, height=792)
        page.insert_text((72, 72), f"Large PDF - Page {i + 1}", fontsize=12)
        img_rect = fitz.Rect(72, 100, 540, 700)
        page.insert_image(img_rect, stream=img_bytes)
        page_count += 1

        # Check size periodically
        if page_count % 50 == 0:
            current_size = len(doc.tobytes())
            if current_size >= target_bytes:
                break

    data = doc.tobytes()
    doc.close()
    return data


def main():
    parser = argparse.ArgumentParser(description="Generate test PDF fixtures")
    parser.add_argument("--large", action="store_true", help="Also generate large (100MB) fixture")
    args = parser.parse_args()

    FIXTURES_DIR.mkdir(exist_ok=True)

    # Small PDF
    small = create_small_pdf()
    (FIXTURES_DIR / "small.pdf").write_bytes(small)
    print(f"Created small.pdf ({len(small):,} bytes)")

    # Multi-page PDF
    multi = create_multi_page_pdf(10)
    (FIXTURES_DIR / "multi_page.pdf").write_bytes(multi)
    print(f"Created multi_page.pdf ({len(multi):,} bytes)")

    # PDF with forms
    forms = create_with_forms_pdf()
    (FIXTURES_DIR / "with_forms.pdf").write_bytes(forms)
    print(f"Created with_forms.pdf ({len(forms):,} bytes)")

    # PDF with annotations
    annots = create_with_annotations_pdf()
    (FIXTURES_DIR / "with_annotations.pdf").write_bytes(annots)
    print(f"Created with_annotations.pdf ({len(annots):,} bytes)")

    # Scanned (image-only) PDF
    scanned = create_scanned_pdf()
    (FIXTURES_DIR / "scanned.pdf").write_bytes(scanned)
    print(f"Created scanned.pdf ({len(scanned):,} bytes)")

    if args.large:
        print("Generating large.pdf (~100MB) -- this may take a minute...")
        large = create_large_pdf(100)
        (FIXTURES_DIR / "large.pdf").write_bytes(large)
        print(f"Created large.pdf ({len(large):,} bytes / {len(large) / 1024 / 1024:.1f} MB)")
        print("WARNING: Do NOT commit large.pdf to git!")
    else:
        print("Skipping large.pdf (use --large to generate)")


if __name__ == "__main__":
    main()
