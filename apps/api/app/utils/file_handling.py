"""
Mudbrick v2 -- File Handling Utilities (Desktop)

Local filesystem operations, PDF validation, formatting helpers.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional


def is_valid_pdf(data: bytes) -> bool:
    """Quick check if bytes look like a valid PDF (magic bytes check)."""
    return data[:5] == b"%PDF-"


def is_valid_pdf_file(path: str) -> bool:
    """Check if a file path points to a valid PDF."""
    p = Path(path)
    if not p.exists() or not p.is_file():
        return False
    with open(p, "rb") as f:
        header = f.read(5)
    return header == b"%PDF-"


def format_file_size(size_bytes: int) -> str:
    """Format a file size in bytes to a human-readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def ensure_dir(path: Path) -> Path:
    """Ensure a directory exists, creating it if necessary."""
    path.mkdir(parents=True, exist_ok=True)
    return path
