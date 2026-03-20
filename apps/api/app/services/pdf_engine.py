"""
Mudbrick v2 -- PDF Engine Core

PyMuPDF (fitz) wrapper for common PDF operations:
open, page count, page dimensions, render to image, save.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF

try:
    from PIL import Image, ImageFile, ImageOps
except ImportError:
    Image = None  # type: ignore[assignment]
    ImageFile = None  # type: ignore[assignment]
    ImageOps = None  # type: ignore[assignment]


@dataclass
class PageInfo:
    """Information about a single PDF page."""

    number: int  # 0-indexed
    width: float
    height: float
    rotation: int


@dataclass
class DocumentInfo:
    """Summary information about a PDF document."""

    page_count: int
    pages: list[PageInfo]
    metadata: dict[str, str]
    file_size: int


class PdfEngine:
    """PyMuPDF wrapper for PDF operations."""

    @staticmethod
    def open_from_bytes(data: bytes) -> fitz.Document:
        """Open a PDF document from bytes."""
        doc = fitz.open(stream=data, filetype="pdf")
        if doc.is_encrypted:
            raise ValueError("Encrypted PDFs are not supported without a password")
        return doc

    @staticmethod
    def open_from_file(path: str) -> fitz.Document:
        """Open a PDF document from a file path."""
        doc = fitz.open(path)
        if doc.is_encrypted:
            raise ValueError("Encrypted PDFs are not supported without a password")
        return doc

    @staticmethod
    def get_document_info(doc: fitz.Document, file_size: int = 0) -> DocumentInfo:
        """Get summary information about a document."""
        pages: list[PageInfo] = []
        for i in range(doc.page_count):
            page = doc[i]
            rect = page.rect
            pages.append(
                PageInfo(
                    number=i,
                    width=rect.width,
                    height=rect.height,
                    rotation=page.rotation,
                )
            )
        return DocumentInfo(
            page_count=doc.page_count,
            pages=pages,
            metadata=dict(doc.metadata) if doc.metadata else {},
            file_size=file_size,
        )

    @staticmethod
    def get_page_count(doc: fitz.Document) -> int:
        """Get the number of pages in a document."""
        return doc.page_count

    @staticmethod
    def get_page_dimensions(doc: fitz.Document, page_num: int) -> tuple[float, float]:
        """Get the dimensions (width, height) of a page (0-indexed)."""
        if page_num < 0 or page_num >= doc.page_count:
            raise IndexError(f"Page {page_num} out of range (0-{doc.page_count - 1})")
        page = doc[page_num]
        return (page.rect.width, page.rect.height)

    @staticmethod
    def render_page_to_image(
        doc: fitz.Document,
        page_num: int,
        dpi: int = 150,
        alpha: bool = False,
        image_format: str = "png",
    ) -> bytes:
        """Render a page to PNG image bytes.

        Args:
            doc: The PDF document.
            page_num: 0-indexed page number.
            dpi: Resolution in dots per inch (default 150).
            alpha: Include alpha channel (default False).
            image_format: Output format ("png" or "jpg").

        Returns:
            Image bytes in the requested format.
        """
        if page_num < 0 or page_num >= doc.page_count:
            raise IndexError(f"Page {page_num} out of range (0-{doc.page_count - 1})")

        page = doc[page_num]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=alpha)
        output = "jpg" if image_format.lower() in {"jpg", "jpeg"} else "png"
        return pix.tobytes(output)

    @staticmethod
    def render_thumbnail(
        doc: fitz.Document, page_num: int, width: int = 200
    ) -> bytes:
        """Render a page thumbnail at a given width, maintaining aspect ratio.

        Args:
            doc: The PDF document.
            page_num: 0-indexed page number.
            width: Target thumbnail width in pixels (default 200).

        Returns:
            PNG image as bytes.
        """
        if page_num < 0 or page_num >= doc.page_count:
            raise IndexError(f"Page {page_num} out of range (0-{doc.page_count - 1})")

        page = doc[page_num]
        rect = page.rect
        zoom = width / rect.width
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        return pix.tobytes("png")

    @staticmethod
    def save_to_bytes(doc: fitz.Document, garbage: int = 3, deflate: bool = True) -> bytes:
        """Save the document to bytes.

        Args:
            doc: The PDF document.
            garbage: Garbage collection level (0-4). 3 = compact xref table.
            deflate: Compress streams (default True).

        Returns:
            PDF bytes.
        """
        return doc.tobytes(garbage=garbage, deflate=deflate)

    @staticmethod
    def rotate_page(doc: fitz.Document, page_num: int, degrees: int) -> None:
        """Rotate a page by the specified degrees (must be multiple of 90)."""
        if degrees % 90 != 0:
            raise ValueError("Rotation must be a multiple of 90 degrees")
        if page_num < 0 or page_num >= doc.page_count:
            raise IndexError(f"Page {page_num} out of range (0-{doc.page_count - 1})")
        page = doc[page_num]
        page.set_rotation((page.rotation + degrees) % 360)

    @staticmethod
    def delete_page(doc: fitz.Document, page_num: int) -> None:
        """Delete a page from the document (0-indexed)."""
        if page_num < 0 or page_num >= doc.page_count:
            raise IndexError(f"Page {page_num} out of range (0-{doc.page_count - 1})")
        doc.delete_page(page_num)

    @staticmethod
    def reorder_pages(doc: fitz.Document, new_order: list[int]) -> None:
        """Reorder pages according to the given list of 0-indexed page numbers.

        Example: [2, 0, 1] moves page 3 first, then page 1, then page 2.
        """
        if sorted(new_order) != list(range(doc.page_count)):
            raise ValueError(
                f"new_order must be a permutation of 0-{doc.page_count - 1}"
            )
        doc.select(new_order)

    @staticmethod
    def insert_blank_page(
        doc: fitz.Document,
        after: int = -1,
        width: float = 612,
        height: float = 792,
    ) -> None:
        """Insert a blank page after the specified page (0-indexed).

        Args:
            doc: The PDF document.
            after: Insert after this page (-1 = at beginning).
            width: Page width in points (default 612 = US Letter).
            height: Page height in points (default 792 = US Letter).
        """
        doc.new_page(pno=after, width=width, height=height)

    @staticmethod
    def merge_documents(docs: list[fitz.Document]) -> fitz.Document:
        """Merge multiple documents into a new document.

        Args:
            docs: List of PDF documents to merge.

        Returns:
            New merged PDF document.
        """
        if not docs:
            raise ValueError("No documents to merge")

        result = fitz.open()
        for doc in docs:
            result.insert_pdf(doc)
        return result

    @staticmethod
    def duplicate_pages(doc: fitz.Document, page_numbers: list[int]) -> fitz.Document:
        """Return a new document with the specified 0-indexed pages duplicated in place."""
        duplicate_set = set(page_numbers)
        result = fitz.open()
        for index in range(doc.page_count):
            result.insert_pdf(doc, from_page=index, to_page=index)
            if index in duplicate_set:
                result.insert_pdf(doc, from_page=index, to_page=index)
        return result

    @staticmethod
    def insert_pages(
        doc: fitz.Document,
        source_doc: fitz.Document,
        *,
        after: int,
        source_pages: list[int] | None = None,
    ) -> fitz.Document:
        """Return a new document with source pages inserted after the given 0-indexed page."""
        result = fitz.open()

        if after >= 0:
            result.insert_pdf(doc, from_page=0, to_page=after)

        if source_pages:
            for page_num in source_pages:
                result.insert_pdf(source_doc, from_page=page_num, to_page=page_num)
        else:
            result.insert_pdf(source_doc)

        if after + 1 < doc.page_count:
            result.insert_pdf(doc, from_page=after + 1, to_page=doc.page_count - 1)

        return result

    @staticmethod
    def replace_page(
        doc: fitz.Document,
        page_num: int,
        replacement_doc: fitz.Document,
        *,
        replacement_page: int = 0,
    ) -> fitz.Document:
        """Return a new document with one 0-indexed page replaced by another document page."""
        result = fitz.open()

        if page_num > 0:
            result.insert_pdf(doc, from_page=0, to_page=page_num - 1)

        result.insert_pdf(replacement_doc, from_page=replacement_page, to_page=replacement_page)

        if page_num + 1 < doc.page_count:
            result.insert_pdf(doc, from_page=page_num + 1, to_page=doc.page_count - 1)

        return result

    @staticmethod
    def image_file_to_pdf(path: str) -> fitz.Document:
        """Convert a standalone image file into a single-page PDF document."""
        if Image is None or ImageFile is None or ImageOps is None:
            image_doc = fitz.open(path)
            try:
                pdf_bytes = image_doc.convert_to_pdf()
            finally:
                image_doc.close()
            return fitz.open(stream=pdf_bytes, filetype="pdf")

        previous_flag = ImageFile.LOAD_TRUNCATED_IMAGES
        ImageFile.LOAD_TRUNCATED_IMAGES = True
        try:
            with Image.open(path) as source:
                prepared = ImageOps.exif_transpose(source)

                if "A" in prepared.getbands():
                    rgba = prepared.convert("RGBA")
                    flattened = Image.new("RGB", rgba.size, (255, 255, 255))
                    flattened.paste(rgba, mask=rgba.getchannel("A"))
                    prepared = flattened
                else:
                    prepared = prepared.convert("RGB")

                dpi_x, dpi_y = source.info.get("dpi", (72, 72))
                dpi_x = dpi_x or 72
                dpi_y = dpi_y or 72
                width_pts = prepared.width * 72.0 / dpi_x
                height_pts = prepared.height * 72.0 / dpi_y

                image_buffer = io.BytesIO()
                prepared.save(image_buffer, format="PNG")
        finally:
            ImageFile.LOAD_TRUNCATED_IMAGES = previous_flag

        result = fitz.open()
        page = result.new_page(width=width_pts, height=height_pts)
        page.insert_image(page.rect, stream=image_buffer.getvalue())
        return result

    @staticmethod
    def create_pdf_from_images(image_paths: list[str]) -> fitz.Document:
        """Convert one or more image files into a multi-page PDF."""
        if not image_paths:
            raise ValueError("At least 1 image file is required")

        result = fitz.open()
        temp_docs: list[fitz.Document] = []
        try:
            for path in image_paths:
                image_path = Path(path)
                if not image_path.exists():
                    raise FileNotFoundError(f"File not found: {path}")
                if not image_path.is_file():
                    raise ValueError(f"Not a file: {path}")

                image_pdf = PdfEngine.image_file_to_pdf(str(image_path))
                temp_docs.append(image_pdf)
                result.insert_pdf(image_pdf)
        finally:
            for temp_doc in temp_docs:
                temp_doc.close()

        return result

    @staticmethod
    def optimize_for_size(doc: fitz.Document) -> bytes:
        """Rewrite the document with the most aggressive safe compaction settings."""
        return PdfEngine.save_to_bytes(doc, garbage=4, deflate=True)

    @staticmethod
    def crop_page(
        doc: fitz.Document,
        page_num: int,
        x: float,
        y: float,
        width: float,
        height: float,
    ) -> None:
        """Crop a page to the specified rectangle.

        Args:
            doc: The PDF document.
            page_num: 0-indexed page number.
            x, y: Top-left corner of crop box.
            width, height: Size of crop box.
        """
        if page_num < 0 or page_num >= doc.page_count:
            raise IndexError(f"Page {page_num} out of range (0-{doc.page_count - 1})")

        page = doc[page_num]
        crop_rect = fitz.Rect(x, y, x + width, y + height)
        page.set_cropbox(crop_rect)
