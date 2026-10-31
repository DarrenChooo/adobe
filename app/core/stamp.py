"""Draw things onto PDF pages: signature images, text, boxes.

Positions come from the browser as fractions (0-1) of the page as displayed,
top-left origin: {page (1-based), x, y, w, h}. That matches PdfPreview's click
coordinates, so the UI never needs to know PDF points.
"""
from __future__ import annotations

import base64
import io
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def decode_image(data: str | bytes) -> bytes:
    """Accept raw bytes, base64, or a data: URL."""
    if isinstance(data, bytes):
        return data
    if data.startswith("data:"):
        data = data.split(",", 1)[1]
    return base64.b64decode(data)


def _box(page, s: dict) -> tuple[float, float, float, float, float, float]:
    """Fractional top-left box -> (x, y, w, h) in PDF points, bottom-left origin,
    plus the page's visible width/height."""
    cb = page.cropbox
    left, bottom = float(cb.left), float(cb.bottom)
    pw, ph = float(cb.width), float(cb.height)
    x = left + float(s.get("x", 0)) * pw
    w = float(s.get("w", 0.2)) * pw
    h = float(s.get("h", 0.05)) * ph
    y = bottom + ph - float(s.get("y", 0)) * ph - h
    return x, y, w, h, pw, ph


def _draw(c: canvas.Canvas, page, s: dict) -> None:
    x, y, w, h, _, _ = _box(page, s)
    kind = s.get("kind", "image")
    if kind == "image":
        img = ImageReader(io.BytesIO(decode_image(s["image"])))
        c.drawImage(img, x, y, w, h, mask="auto", preserveAspectRatio=True, anchor="c")
    elif kind in ("rect", "whiteout"):
        fill = s.get("fill", "#ffffff" if kind == "whiteout" else None)
        stroke = s.get("stroke")
        if fill:
            c.setFillColor(HexColor(fill))
        if stroke:
            c.setStrokeColor(HexColor(stroke))
        c.rect(x, y, w, h, stroke=1 if stroke else 0, fill=1 if fill else 0)
        if s.get("text"):
            _text(c, x, y, w, h, s)
    elif kind == "text":
        _text(c, x, y, w, h, s)
    else:
        raise ValueError(f"Unknown stamp kind '{kind}'")


def _text(c: canvas.Canvas, x: float, y: float, w: float, h: float, s: dict) -> None:
    size = float(s.get("font_size") or max(6.0, min(h * 0.7, 14.0)))
    c.setFillColor(HexColor(s.get("color", "#000000")))
    font = "Helvetica-Bold" if s.get("bold") else "Helvetica"
    c.setFont(font, size)
    lines = str(s.get("text", "")).splitlines() or [""]
    ty = y + h - size  # first baseline, top-aligned
    for line in lines:
        c.drawString(x + 2, ty + size * 0.2, line)
        ty -= size * 1.2


def apply_stamps(src: Path | str, dst: Path | str, stamps: list[dict], password: str | None = None) -> int:
    """Draw every stamp onto its page and write `dst`. Returns pages touched."""
    reader = PdfReader(str(src))
    if reader.is_encrypted:
        reader.decrypt(password or "")
    writer = PdfWriter(clone_from=reader)
    by_page: dict[int, list[dict]] = {}
    for s in stamps:
        n = int(s.get("page", 1))
        if not 1 <= n <= len(writer.pages):
            raise ValueError(f"Page {n} doesn't exist (the PDF has {len(writer.pages)}).")
        by_page.setdefault(n, []).append(s)
    for n, items in by_page.items():
        page = writer.pages[n - 1]
        if page.rotation % 360:
            # Bake rotation into content so displayed coordinates == PDF coordinates.
            page.transfer_rotation_to_content()
        buf = io.BytesIO()
        cb = page.cropbox
        c = canvas.Canvas(buf, pagesize=(float(cb.right), float(cb.top)))
        for s in items:
            _draw(c, page, s)
        c.showPage()
        c.save()
        page.merge_page(PdfReader(io.BytesIO(buf.getvalue())).pages[0])
    with open(dst, "wb") as f:
        writer.write(f)
    return len(by_page)
