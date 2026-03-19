"""
Mudbrick v2 -- Legal Text Stamping Service

Shared helpers for legal-document text features:
- Bates numbering
- Headers / footers
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import fitz


STANDARD_FONTS = {
    "Helvetica": "Helvetica",
    "HelveticaBold": "Helvetica-Bold",
    "HelveticaOblique": "Helvetica-Oblique",
    "HelveticaBoldOblique": "Helvetica-BoldOblique",
    "TimesRoman": "Times-Roman",
    "TimesRomanBold": "Times-Bold",
    "TimesRomanItalic": "Times-Italic",
    "TimesRomanBoldItalic": "Times-BoldItalic",
    "Courier": "Courier",
    "CourierBold": "Courier-Bold",
    "CourierOblique": "Courier-Oblique",
    "CourierBoldOblique": "Courier-BoldOblique",
}

ZONE_POSITIONS = (
    "top_left",
    "top_center",
    "top_right",
    "bottom_left",
    "bottom_center",
    "bottom_right",
)

POSITION_ALIGNS = {
    "top-left": fitz.TEXT_ALIGN_LEFT,
    "top-center": fitz.TEXT_ALIGN_CENTER,
    "top-right": fitz.TEXT_ALIGN_RIGHT,
    "bottom-left": fitz.TEXT_ALIGN_LEFT,
    "bottom-center": fitz.TEXT_ALIGN_CENTER,
    "bottom-right": fitz.TEXT_ALIGN_RIGHT,
    "top_left": fitz.TEXT_ALIGN_LEFT,
    "top_center": fitz.TEXT_ALIGN_CENTER,
    "top_right": fitz.TEXT_ALIGN_RIGHT,
    "bottom_left": fitz.TEXT_ALIGN_LEFT,
    "bottom_center": fitz.TEXT_ALIGN_CENTER,
    "bottom_right": fitz.TEXT_ALIGN_RIGHT,
}


@dataclass
class BatesOptions:
    prefix: str = ""
    suffix: str = ""
    start_num: int = 1
    zero_pad: int = 6
    position: str = "bottom-center"
    font: str = "Helvetica"
    font_size: float = 10
    color: str = "#000000"
    start_page: int = 1
    end_page: int = 0
    margin: float = 0.5


@dataclass
class HeaderFooterOptions:
    top_left: str = ""
    top_center: str = ""
    top_right: str = ""
    bottom_left: str = ""
    bottom_center: str = ""
    bottom_right: str = ""
    font: str = "Helvetica"
    font_size: float = 10
    color: str = "#000000"
    margin: float = 0.5
    filename: str = ""
    start_page: int = 1
    end_page: int = 0
    skip_first: bool = False
    skip_last: bool = False
    mirror: bool = False
    draw_line: bool = False


def apply_bates_numbers(doc: fitz.Document, options: BatesOptions) -> tuple[str, str]:
    """Stamp sequential Bates numbers across a page range."""
    font_name = resolve_font_name(options.font)
    color = parse_hex_color(options.color)
    margin = inches_to_points(options.margin)
    box_height = text_box_height(options.font_size)

    first_index = max(0, options.start_page - 1)
    last_index = doc.page_count if options.end_page <= 0 else min(doc.page_count, options.end_page)

    number = options.start_num
    first_label = ""
    last_label = ""

    for index in range(first_index, last_index):
        page = doc[index]
        label = f"{options.prefix}{str(number).zfill(options.zero_pad)}{options.suffix}"
        rect = build_text_rect(page.rect, options.position, margin, box_height)
        inserted = page.insert_textbox(
            rect,
            label,
            fontname=font_name,
            fontsize=options.font_size,
            color=color,
            align=POSITION_ALIGNS[options.position],
            overlay=True,
        )
        if inserted < 0:
            raise ValueError(f"Bates label did not fit on page {index + 1}")

        if not first_label:
            first_label = label
        last_label = label
        number += 1

    return first_label, last_label


def apply_headers_footers(
    doc: fitz.Document,
    options: HeaderFooterOptions,
    *,
    fallback_filename: str = "",
) -> None:
    """Stamp header / footer text into the standard six zones."""
    font_name = resolve_font_name(options.font)
    color = parse_hex_color(options.color)
    margin = inches_to_points(options.margin)
    box_height = text_box_height(options.font_size)
    filename = options.filename or fallback_filename

    templates = {
        "top_left": options.top_left,
        "top_center": options.top_center,
        "top_right": options.top_right,
        "bottom_left": options.bottom_left,
        "bottom_center": options.bottom_center,
        "bottom_right": options.bottom_right,
    }
    if not any(value.strip() for value in templates.values()):
        return

    first_index = max(0, options.start_page - 1)
    last_index = doc.page_count if options.end_page <= 0 else min(doc.page_count, options.end_page)

    for index in range(first_index, last_index):
        page_num = index + 1
        if options.skip_first and page_num == 1:
            continue
        if options.skip_last and page_num == doc.page_count:
            continue

        page = doc[index]
        has_top_content = False
        has_bottom_content = False

        for zone in ZONE_POSITIONS:
            source_zone = mirrored_zone(zone, page_num, options.mirror)
            text = replace_tokens(
                templates[source_zone],
                page_num=page_num,
                total_pages=doc.page_count,
                filename=filename,
                metadata=doc.metadata or {},
            )
            if not text:
                continue

            rect = build_text_rect(page.rect, zone, margin, box_height)
            inserted = page.insert_textbox(
                rect,
                text,
                fontname=font_name,
                fontsize=options.font_size,
                color=color,
                align=POSITION_ALIGNS[zone],
                overlay=True,
            )
            if inserted < 0:
                raise ValueError(f"Header/footer text did not fit on page {page_num}")

            if zone.startswith("top"):
                has_top_content = True
            else:
                has_bottom_content = True

        if options.draw_line:
            draw_separator_lines(
                page,
                margin=margin,
                box_height=box_height,
                color=color,
                has_top_content=has_top_content,
                has_bottom_content=has_bottom_content,
            )


def build_text_rect(page_rect: fitz.Rect, position: str, margin: float, box_height: float) -> fitz.Rect:
    """Build a standard text rectangle covering the page width between margins."""
    y = margin if position.startswith("top") else page_rect.height - margin - box_height
    return fitz.Rect(margin, y, page_rect.width - margin, y + box_height)


def draw_separator_lines(
    page: fitz.Page,
    *,
    margin: float,
    box_height: float,
    color: tuple[float, float, float],
    has_top_content: bool,
    has_bottom_content: bool,
) -> None:
    if has_top_content:
        top_y = margin + box_height + 2
        page.draw_line(
            fitz.Point(margin, top_y),
            fitz.Point(page.rect.width - margin, top_y),
            color=color,
            width=0.5,
        )

    if has_bottom_content:
        bottom_y = page.rect.height - margin - box_height - 2
        page.draw_line(
            fitz.Point(margin, bottom_y),
            fitz.Point(page.rect.width - margin, bottom_y),
            color=color,
            width=0.5,
        )


def replace_tokens(
    template: str,
    *,
    page_num: int,
    total_pages: int,
    filename: str,
    metadata: dict[str, str],
) -> str:
    """Replace standard header/footer tokens inside a template string."""
    if not template:
        return ""

    now = datetime.now()
    date_str = now.strftime("%m/%d/%Y")
    time_str = now.strftime("%I:%M %p").lstrip("0")
    author = metadata.get("author", "") or ""
    title = metadata.get("title", "") or ""

    return (
        template.replace("{page}", str(page_num))
        .replace("{pages}", str(total_pages))
        .replace("{date}", date_str)
        .replace("{time}", time_str)
        .replace("{filename}", filename)
        .replace("{author}", author)
        .replace("{title}", title)
    )


def resolve_font_name(font_name: str) -> str:
    return STANDARD_FONTS.get(font_name, STANDARD_FONTS["Helvetica"])


def parse_hex_color(hex_value: str) -> tuple[float, float, float]:
    color = hex_value.strip()
    if not color.startswith("#") or len(color) != 7:
        raise ValueError(f"Invalid color value: {hex_value}")

    return (
        int(color[1:3], 16) / 255.0,
        int(color[3:5], 16) / 255.0,
        int(color[5:7], 16) / 255.0,
    )


def inches_to_points(inches: float) -> float:
    return max(0.0, inches) * 72.0


def text_box_height(font_size: float) -> float:
    return max(18.0, font_size * 1.8)


def mirrored_zone(zone: str, page_num: int, mirror_enabled: bool) -> str:
    """Swap left/right zones on even pages when mirror mode is enabled."""
    if not mirror_enabled or page_num % 2 != 0:
        return zone

    if zone.endswith("_left"):
        return zone.replace("_left", "_right")
    if zone.endswith("_right"):
        return zone.replace("_right", "_left")
    return zone


def default_filename_from_path(file_path: str) -> str:
    if not file_path:
        return ""
    return Path(file_path).name
