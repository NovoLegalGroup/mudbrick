"""
Mudbrick v2 -- Annotation Pydantic Models

Models for Fabric.js JSON annotation objects exchanged between frontend and backend.
"""

from __future__ import annotations

from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, Field


class FabricObjectBase(BaseModel):
    """Base fields present on all Fabric.js objects."""

    type: str
    left: float = 0
    top: float = 0
    width: float = 0
    height: float = 0
    scaleX: float = 1
    scaleY: float = 1
    angle: float = 0
    opacity: float = 1
    visible: bool = True
    fill: Optional[str] = None
    stroke: Optional[str] = None
    strokeWidth: float = 1
    originX: str = "left"
    originY: str = "top"


class FabricPath(FabricObjectBase):
    """Freehand drawing (pen/draw tool)."""

    type: Literal["path"] = "path"
    path: list[list[Any]] = Field(default_factory=list)


class FabricRect(FabricObjectBase):
    """Rectangle -- used for highlights, redaction covers, and shapes."""

    type: Literal["rect"] = "rect"
    rx: float = 0
    ry: float = 0
    tool: Optional[str] = None  # "highlight", "redact", or None for shape


class FabricEllipse(FabricObjectBase):
    """Ellipse shape."""

    type: Literal["ellipse"] = "ellipse"
    rx: float = 0
    ry: float = 0


class FabricLine(FabricObjectBase):
    """Line or arrow."""

    type: Literal["line"] = "line"
    x1: float = 0
    y1: float = 0
    x2: float = 0
    y2: float = 0
    tool: Optional[str] = None  # "arrow" for arrow lines


class FabricTextbox(FabricObjectBase):
    """Text annotation."""

    type: Literal["textbox"] = "textbox"
    text: str = ""
    fontSize: float = 16
    fontFamily: str = "Arial"
    fontWeight: str = "normal"
    fontStyle: str = "normal"
    textAlign: str = "left"
    underline: bool = False
    linethrough: bool = False


class FabricImage(FabricObjectBase):
    """Image stamp."""

    type: Literal["image"] = "image"
    src: str = ""
    tool: Optional[str] = None  # "stamp"


FabricObject = Union[
    FabricPath, FabricRect, FabricEllipse, FabricLine, FabricTextbox, FabricImage
]


class AnnotationSet(BaseModel):
    """A set of annotations for a single page, in Fabric.js JSON format."""

    version: str = "6.0.0"
    objects: list[dict[str, Any]] = Field(default_factory=list)


class ExportRequest(BaseModel):
    """Request body for the export endpoint."""

    annotations: dict[str, AnnotationSet] = Field(
        default_factory=dict,
        description="Page annotations keyed by page number (1-indexed string)",
    )
    options: dict[str, Any] = Field(default_factory=dict)


class ExportResponse(BaseModel):
    """Response from the export endpoint."""

    download_url: str
