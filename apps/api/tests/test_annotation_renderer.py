"""
Mudbrick v2 -- Tests for Annotation Renderer
"""

from __future__ import annotations

import fitz
import pytest

from app.services.annotation_renderer import (
    render_annotations_to_page,
    hex_to_rgb,
    parse_color,
)


@pytest.fixture
def blank_page() -> tuple[fitz.Document, fitz.Page]:
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    return doc, page


class TestColorParsing:
    def test_hex_to_rgb(self):
        assert hex_to_rgb("#ff0000") == pytest.approx((1.0, 0, 0), abs=0.01)
        assert hex_to_rgb("#00ff00") == pytest.approx((0, 1.0, 0), abs=0.01)
        assert hex_to_rgb("#0000ff") == pytest.approx((0, 0, 1.0), abs=0.01)
        assert hex_to_rgb("#000000") == (0, 0, 0)
        assert hex_to_rgb("#ffffff") == pytest.approx((1.0, 1.0, 1.0), abs=0.01)

    def test_hex_short(self):
        assert hex_to_rgb("#f00") == pytest.approx((1.0, 0, 0), abs=0.01)

    def test_parse_color_none(self):
        assert parse_color(None) is None
        assert parse_color("transparent") is None
        assert parse_color("none") is None

    def test_parse_color_hex(self):
        result = parse_color("#ff0000")
        assert result is not None
        assert result == pytest.approx((1.0, 0, 0), abs=0.01)

    def test_parse_color_rgb(self):
        result = parse_color("rgb(255, 0, 0)")
        assert result is not None
        assert result == pytest.approx((1.0, 0, 0), abs=0.01)


class TestAnnotationRenderer:
    def test_render_empty(self, blank_page):
        doc, page = blank_page
        render_annotations_to_page(page, [], 612, 792)
        # Should not crash
        doc.close()

    def test_render_path(self, blank_page):
        doc, page = blank_page
        path_annotation = {
            "type": "path",
            "left": 100,
            "top": 100,
            "scaleX": 1,
            "scaleY": 1,
            "visible": True,
            "opacity": 1,
            "stroke": "#ff0000",
            "strokeWidth": 3,
            "path": [
                ["M", 0, 0],
                ["L", 50, 50],
                ["L", 100, 0],
            ],
        }
        render_annotations_to_page(page, [path_annotation], 612, 792)
        data = doc.tobytes()
        assert len(data) > 0
        doc.close()

    def test_render_highlight(self, blank_page):
        doc, page = blank_page
        highlight = {
            "type": "rect",
            "tool": "highlight",
            "left": 72,
            "top": 72,
            "width": 200,
            "height": 20,
            "scaleX": 1,
            "scaleY": 1,
            "visible": True,
            "opacity": 0.4,
            "fill": "#ffff00",
        }
        render_annotations_to_page(page, [highlight], 612, 792)
        data = doc.tobytes()
        assert len(data) > 0
        doc.close()

    def test_render_redact_cover(self, blank_page):
        doc, page = blank_page
        redact = {
            "type": "rect",
            "tool": "redact",
            "left": 100,
            "top": 100,
            "width": 200,
            "height": 30,
            "scaleX": 1,
            "scaleY": 1,
            "visible": True,
            "opacity": 1,
            "fill": "#000000",
        }
        render_annotations_to_page(page, [redact], 612, 792)
        data = doc.tobytes()
        assert len(data) > 0
        doc.close()

    def test_render_rect_shape(self, blank_page):
        doc, page = blank_page
        rect = {
            "type": "rect",
            "left": 50,
            "top": 50,
            "width": 100,
            "height": 80,
            "scaleX": 1,
            "scaleY": 1,
            "visible": True,
            "opacity": 1,
            "fill": "#0000ff",
            "stroke": "#000000",
            "strokeWidth": 2,
        }
        render_annotations_to_page(page, [rect], 612, 792)
        data = doc.tobytes()
        assert len(data) > 0
        doc.close()

    def test_render_ellipse(self, blank_page):
        doc, page = blank_page
        ellipse = {
            "type": "ellipse",
            "left": 200,
            "top": 200,
            "width": 100,
            "height": 60,
            "scaleX": 1,
            "scaleY": 1,
            "visible": True,
            "opacity": 0.8,
            "fill": "#00ff00",
            "stroke": "#006600",
            "strokeWidth": 2,
            "rx": 50,
            "ry": 30,
        }
        render_annotations_to_page(page, [ellipse], 612, 792)
        data = doc.tobytes()
        assert len(data) > 0
        doc.close()

    def test_render_line(self, blank_page):
        doc, page = blank_page
        line = {
            "type": "line",
            "left": 100,
            "top": 100,
            "width": 200,
            "height": 0,
            "scaleX": 1,
            "scaleY": 1,
            "visible": True,
            "opacity": 1,
            "stroke": "#000000",
            "strokeWidth": 2,
            "x1": 0,
            "y1": 0,
            "x2": 200,
            "y2": 100,
        }
        render_annotations_to_page(page, [line], 612, 792)
        data = doc.tobytes()
        assert len(data) > 0
        doc.close()

    def test_render_textbox(self, blank_page):
        doc, page = blank_page
        textbox = {
            "type": "textbox",
            "left": 72,
            "top": 72,
            "width": 200,
            "height": 50,
            "scaleX": 1,
            "scaleY": 1,
            "visible": True,
            "opacity": 1,
            "fill": "#000000",
            "text": "Hello World",
            "fontSize": 16,
            "fontFamily": "Arial",
            "fontWeight": "normal",
            "fontStyle": "normal",
            "textAlign": "left",
        }
        render_annotations_to_page(page, [textbox], 612, 792)
        data = doc.tobytes()
        assert len(data) > 0
        doc.close()

    def test_render_invisible_skipped(self, blank_page):
        doc, page = blank_page
        invisible = {
            "type": "rect",
            "left": 0,
            "top": 0,
            "width": 100,
            "height": 100,
            "scaleX": 1,
            "scaleY": 1,
            "visible": False,
            "opacity": 1,
            "fill": "#ff0000",
        }
        render_annotations_to_page(page, [invisible], 612, 792)
        doc.close()

    def test_render_multiple_annotations(self, blank_page):
        doc, page = blank_page
        annotations = [
            {
                "type": "rect",
                "tool": "highlight",
                "left": 72, "top": 72,
                "width": 200, "height": 20,
                "scaleX": 1, "scaleY": 1,
                "visible": True, "opacity": 0.4,
                "fill": "#ffff00",
            },
            {
                "type": "textbox",
                "left": 72, "top": 100,
                "width": 200, "height": 30,
                "scaleX": 1, "scaleY": 1,
                "visible": True, "opacity": 1,
                "fill": "#000000",
                "text": "Annotation text",
                "fontSize": 12,
                "fontFamily": "Arial",
            },
            {
                "type": "path",
                "left": 300, "top": 300,
                "scaleX": 1, "scaleY": 1,
                "visible": True, "opacity": 1,
                "stroke": "#ff0000",
                "strokeWidth": 2,
                "path": [["M", 0, 0], ["L", 50, 50]],
            },
        ]
        render_annotations_to_page(page, annotations, 612, 792)
        data = doc.tobytes()
        # Verify PDF is still valid
        reopened = fitz.open(stream=data, filetype="pdf")
        assert reopened.page_count == 1
        reopened.close()
        doc.close()
