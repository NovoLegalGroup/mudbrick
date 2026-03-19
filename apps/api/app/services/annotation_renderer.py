"""
Mudbrick v2 -- Annotation Renderer

Converts Fabric.js JSON annotations to PyMuPDF drawing commands.
This is the CRITICAL bridge between client-side annotations and server-side PDF export.

Supported annotation types:
1. Path (freehand drawing)
2. Rect (highlight, redaction cover, shape)
3. Ellipse (shape)
4. Line/Arrow (shape)
5. Textbox (text annotation)
6. Image (stamp)
"""

from __future__ import annotations

import base64
import io
import math
from typing import Any, Optional

import fitz  # PyMuPDF


def hex_to_rgb(hex_color: str) -> tuple[float, float, float]:
    """Convert hex color (#rrggbb or #rgb) to normalized RGB tuple (0-1)."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    if len(hex_color) != 6:
        return (0, 0, 0)
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return (r, g, b)


def parse_color(color: Optional[str]) -> Optional[tuple[float, float, float]]:
    """Parse a CSS color string to RGB tuple. Returns None for transparent/None."""
    if not color or color == "transparent" or color == "none":
        return None
    if color.startswith("#"):
        return hex_to_rgb(color)
    if color.startswith("rgb"):
        # Parse rgb(r, g, b) or rgba(r, g, b, a)
        nums = color.replace("rgb", "").replace("a", "").strip("()").split(",")
        try:
            r = int(nums[0].strip()) / 255
            g = int(nums[1].strip()) / 255
            b = int(nums[2].strip()) / 255
            return (r, g, b)
        except (ValueError, IndexError):
            return (0, 0, 0)
    return (0, 0, 0)


def render_annotations_to_page(
    page: fitz.Page,
    annotations: list[dict[str, Any]],
    page_width: float,
    page_height: float,
) -> None:
    """Render a list of Fabric.js annotation objects onto a PyMuPDF page.

    Args:
        page: The PyMuPDF page to draw on.
        annotations: List of Fabric.js JSON objects.
        page_width: CSS pixel width the annotations were drawn at.
        page_height: CSS pixel height the annotations were drawn at.
    """
    rect = page.rect
    scale_x = rect.width / page_width if page_width > 0 else 1
    scale_y = rect.height / page_height if page_height > 0 else 1

    for obj in annotations:
        if not obj.get("visible", True):
            continue

        obj_type = obj.get("type", "")
        opacity = obj.get("opacity", 1.0)
        tool = obj.get("tool", "")

        try:
            if obj_type == "path":
                _render_path(page, obj, scale_x, scale_y, opacity)
            elif obj_type == "rect":
                if tool == "highlight":
                    _render_highlight(page, obj, scale_x, scale_y, opacity)
                elif tool == "redact":
                    _render_redact_cover(page, obj, scale_x, scale_y)
                else:
                    _render_rect(page, obj, scale_x, scale_y, opacity)
            elif obj_type == "ellipse":
                _render_ellipse(page, obj, scale_x, scale_y, opacity)
            elif obj_type == "line":
                _render_line(page, obj, scale_x, scale_y, opacity)
            elif obj_type == "textbox":
                _render_textbox(page, obj, scale_x, scale_y, opacity)
            elif obj_type == "image":
                _render_image(page, obj, scale_x, scale_y, opacity)
        except Exception as e:
            # Don't let a single bad annotation break the entire export
            print(f"Warning: Failed to render annotation {obj_type}: {e}")


def _get_obj_rect(
    obj: dict, scale_x: float, scale_y: float
) -> fitz.Rect:
    """Calculate the actual rectangle of an object considering position, size, and scale."""
    left = obj.get("left", 0) * scale_x
    top = obj.get("top", 0) * scale_y
    width = obj.get("width", 0) * obj.get("scaleX", 1) * scale_x
    height = obj.get("height", 0) * obj.get("scaleY", 1) * scale_y
    return fitz.Rect(left, top, left + width, top + height)


def _render_path(
    page: fitz.Page,
    obj: dict,
    scale_x: float,
    scale_y: float,
    opacity: float,
) -> None:
    """Render a freehand path (draw tool)."""
    path_data = obj.get("path", [])
    if not path_data:
        return

    stroke_color = parse_color(obj.get("stroke", "#000000"))
    stroke_width = obj.get("strokeWidth", 2) * scale_x
    obj_left = obj.get("left", 0) * scale_x
    obj_top = obj.get("top", 0) * scale_y
    obj_scale_x = obj.get("scaleX", 1) * scale_x
    obj_scale_y = obj.get("scaleY", 1) * scale_y

    shape = page.new_shape()

    first_point = True
    for segment in path_data:
        if not segment:
            continue
        cmd = segment[0]
        if cmd == "M" and len(segment) >= 3:
            x = obj_left + segment[1] * obj_scale_x
            y = obj_top + segment[2] * obj_scale_y
            if first_point:
                shape.draw_line(fitz.Point(x, y), fitz.Point(x, y))
                first_point = False
            else:
                shape.draw_line(shape.last_point, fitz.Point(x, y))
        elif cmd == "L" and len(segment) >= 3:
            x = obj_left + segment[1] * obj_scale_x
            y = obj_top + segment[2] * obj_scale_y
            shape.draw_line(shape.last_point, fitz.Point(x, y))
        elif cmd == "Q" and len(segment) >= 5:
            # Quadratic bezier: approximate with line to endpoint
            x = obj_left + segment[3] * obj_scale_x
            y = obj_top + segment[4] * obj_scale_y
            shape.draw_line(shape.last_point, fitz.Point(x, y))

    if stroke_color:
        shape.finish(color=stroke_color, width=stroke_width, closePath=False)
    shape.commit(overlay=True)


def _render_highlight(
    page: fitz.Page,
    obj: dict,
    scale_x: float,
    scale_y: float,
    opacity: float,
) -> None:
    """Render a highlight rectangle (semi-transparent fill)."""
    rect = _get_obj_rect(obj, scale_x, scale_y)
    fill_color = parse_color(obj.get("fill", "#ffff00"))
    if fill_color:
        shape = page.new_shape()
        shape.draw_rect(rect)
        # Highlights use a lower opacity by default
        highlight_opacity = min(opacity, 0.4)
        shape.finish(fill=fill_color, fill_opacity=highlight_opacity)
        shape.commit(overlay=True)


def _render_redact_cover(
    page: fitz.Page,
    obj: dict,
    scale_x: float,
    scale_y: float,
) -> None:
    """Render a visual redaction cover (opaque black rectangle)."""
    rect = _get_obj_rect(obj, scale_x, scale_y)
    fill_color = parse_color(obj.get("fill", "#000000")) or (0, 0, 0)
    shape = page.new_shape()
    shape.draw_rect(rect)
    shape.finish(fill=fill_color, fill_opacity=1.0)
    shape.commit(overlay=True)


def _render_rect(
    page: fitz.Page,
    obj: dict,
    scale_x: float,
    scale_y: float,
    opacity: float,
) -> None:
    """Render a rectangle shape."""
    rect = _get_obj_rect(obj, scale_x, scale_y)
    fill_color = parse_color(obj.get("fill"))
    stroke_color = parse_color(obj.get("stroke"))
    stroke_width = obj.get("strokeWidth", 1) * scale_x

    shape = page.new_shape()
    shape.draw_rect(rect)
    shape.finish(
        fill=fill_color,
        color=stroke_color,
        width=stroke_width if stroke_color else 0,
        fill_opacity=opacity,
        stroke_opacity=opacity,
    )
    shape.commit(overlay=True)


def _render_ellipse(
    page: fitz.Page,
    obj: dict,
    scale_x: float,
    scale_y: float,
    opacity: float,
) -> None:
    """Render an ellipse shape."""
    rect = _get_obj_rect(obj, scale_x, scale_y)
    fill_color = parse_color(obj.get("fill"))
    stroke_color = parse_color(obj.get("stroke"))
    stroke_width = obj.get("strokeWidth", 1) * scale_x

    shape = page.new_shape()
    shape.draw_oval(rect)
    shape.finish(
        fill=fill_color,
        color=stroke_color,
        width=stroke_width if stroke_color else 0,
        fill_opacity=opacity,
        stroke_opacity=opacity,
    )
    shape.commit(overlay=True)


def _render_line(
    page: fitz.Page,
    obj: dict,
    scale_x: float,
    scale_y: float,
    opacity: float,
) -> None:
    """Render a line or arrow."""
    left = obj.get("left", 0) * scale_x
    top = obj.get("top", 0) * scale_y
    x1 = left + obj.get("x1", 0) * scale_x
    y1 = top + obj.get("y1", 0) * scale_y
    x2 = left + obj.get("x2", 0) * scale_x
    y2 = top + obj.get("y2", 0) * scale_y

    stroke_color = parse_color(obj.get("stroke", "#000000"))
    stroke_width = obj.get("strokeWidth", 2) * scale_x

    shape = page.new_shape()
    shape.draw_line(fitz.Point(x1, y1), fitz.Point(x2, y2))

    if stroke_color:
        shape.finish(color=stroke_color, width=stroke_width, stroke_opacity=opacity)

    # Draw arrowhead if it's an arrow tool
    if obj.get("tool") == "arrow" and stroke_color:
        _draw_arrowhead(shape, x1, y1, x2, y2, stroke_width * 3, stroke_color)

    shape.commit(overlay=True)


def _draw_arrowhead(
    shape: fitz.Shape,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    size: float,
    color: tuple[float, float, float],
) -> None:
    """Draw an arrowhead at the end of a line."""
    angle = math.atan2(y2 - y1, x2 - x1)
    arrow_angle = math.pi / 6  # 30 degrees

    ax = x2 - size * math.cos(angle - arrow_angle)
    ay = y2 - size * math.sin(angle - arrow_angle)
    bx = x2 - size * math.cos(angle + arrow_angle)
    by = y2 - size * math.sin(angle + arrow_angle)

    shape.draw_line(fitz.Point(x2, y2), fitz.Point(ax, ay))
    shape.draw_line(fitz.Point(x2, y2), fitz.Point(bx, by))
    shape.finish(color=color, width=size / 3)


def _render_textbox(
    page: fitz.Page,
    obj: dict,
    scale_x: float,
    scale_y: float,
    opacity: float,
) -> None:
    """Render a text annotation."""
    text = obj.get("text", "")
    if not text:
        return

    rect = _get_obj_rect(obj, scale_x, scale_y)
    font_size = obj.get("fontSize", 16) * obj.get("scaleY", 1) * scale_y
    fill_color = parse_color(obj.get("fill", "#000000")) or (0, 0, 0)
    font_family = obj.get("fontFamily", "helv")

    # Map common font names to PyMuPDF built-in fonts
    font_map = {
        "Arial": "helv",
        "Helvetica": "helv",
        "Times New Roman": "tiro",
        "Times": "tiro",
        "Courier New": "cour",
        "Courier": "cour",
    }
    pymupdf_font = font_map.get(font_family, "helv")

    # Insert text with word wrapping
    writer = fitz.TextWriter(page.rect)
    try:
        writer.fill_textbox(
            rect,
            text,
            fontsize=font_size,
            fontname=pymupdf_font,
            color=fill_color,
            align=_text_align(obj.get("textAlign", "left")),
        )
        writer.write_text(page, overlay=True, opacity=opacity)
    except Exception:
        # Fallback: simple text insertion
        page.insert_text(
            fitz.Point(rect.x0, rect.y0 + font_size),
            text,
            fontsize=font_size,
            fontname=pymupdf_font,
            color=fill_color,
            overlay=True,
        )


def _text_align(align: str) -> int:
    """Convert CSS text-align to PyMuPDF alignment constant."""
    return {"left": 0, "center": 1, "right": 2, "justify": 3}.get(align, 0)


def _render_image(
    page: fitz.Page,
    obj: dict,
    scale_x: float,
    scale_y: float,
    opacity: float,
) -> None:
    """Render an image stamp annotation."""
    src = obj.get("src", "")
    if not src:
        return

    rect = _get_obj_rect(obj, scale_x, scale_y)

    try:
        if src.startswith("data:"):
            # Base64 encoded image
            _, data_part = src.split(",", 1)
            img_bytes = base64.b64decode(data_part)
        else:
            # URL -- skip for now (would need to download)
            return

        page.insert_image(rect, stream=img_bytes, overlay=True)
    except Exception as e:
        print(f"Warning: Failed to insert image stamp: {e}")
