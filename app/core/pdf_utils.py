"""Shared PDF helpers. B and C rely on these; keep signatures stable."""
from __future__ import annotations

import io
from pathlib import Path

import pypdfium2 as pdfium
from pypdf import PdfReader


def open_pdf(path: Path | str, password: str | None = None) -> PdfReader:
    """Open with pypdf. Decrypts with `password` (or the empty password) if encrypted."""
    reader = PdfReader(str(path))
    if reader.is_encrypted and not reader.decrypt(password or ""):
        raise ValueError("This PDF is password-protected: the password is wrong or missing.")
    return reader


def is_pdf(path: Path | str) -> bool:
    try:
        with open(path, "rb") as f:
            return b"%PDF-" in f.read(1024)
    except OSError:
        return False


def page_count(path: Path | str) -> int:
    """Number of pages, or 0 if the file isn't a readable PDF."""
    if not is_pdf(path):
        return 0
    try:
        return len(PdfReader(str(path)).pages)
    except Exception:
        return 0


def render_page_image(path: Path | str, page: int = 0, dpi: int = 100, password: str | None = None):
    """Render one page (0-based) to a PIL Image."""
    doc = pdfium.PdfDocument(str(path), password=password)
    try:
        return doc[page].render(scale=dpi / 72).to_pil()
    finally:
        doc.close()


def render_page_png(path: Path | str, page: int = 0, dpi: int = 100, password: str | None = None) -> bytes:
    """Render one page (0-based) to PNG bytes."""
    buf = io.BytesIO()
    render_page_image(path, page, dpi, password).save(buf, format="PNG")
    return buf.getvalue()


def page_size(path: Path | str, page: int = 0) -> tuple[float, float]:
    """(width, height) of a page in PDF points."""
    doc = pdfium.PdfDocument(str(path))
    try:
        w, h = doc[page].get_size()
        return w, h
    finally:
        doc.close()


def text_with_boxes(path: Path | str, page: int = 0, password: str | None = None) -> list[dict]:
    """Words on a page (0-based) with boxes in PDF points, origin at the TOP-left
    (pdfplumber's convention): [{text, x0, top, x1, bottom}]. Uses pypdfium2 only."""
    doc = pdfium.PdfDocument(str(path), password=password)
    try:
        pg = doc[page]
        height = pg.get_size()[1]
        bottom_edge = pg.get_cropbox()[1]
        tp = pg.get_textpage()
        try:
            words: list[dict] = []
            cur: dict | None = None
            for i in range(tp.count_chars()):
                ch = tp.get_text_range(i, 1)
                if not ch or ch.isspace() or ch in "\r\n\x02￾":
                    cur = None
                    continue
                l, b, r, t = tp.get_charbox(i, loose=True)  # full font height, not the glyph's ink
                top, bot = height - (t - bottom_edge), height - (b - bottom_edge)
                # Same line and touching the previous char -> same word.
                if cur and abs(cur["top"] - top) < 2 and l - cur["x1"] < 0.15 * (bot - top):
                    cur["text"] += ch
                    cur["x1"] = max(cur["x1"], r)
                    cur["top"] = min(cur["top"], top)
                    cur["bottom"] = max(cur["bottom"], bot)
                else:
                    cur = {"text": ch, "x0": l, "top": top, "x1": r, "bottom": bot}
                    words.append(cur)
            return words
        finally:
            tp.close()
    finally:
        doc.close()


def page_text(path: Path | str, page: int = 0) -> str:
    """Plain text of one page (0-based)."""
    doc = pdfium.PdfDocument(str(path))
    try:
        tp = doc[page].get_textpage()
        try:
            return tp.get_text_range()
        finally:
            tp.close()
    finally:
        doc.close()


def parse_ranges(spec: str, n_pages: int) -> list[list[int]]:
    """'1-3,5,7-' -> [[0,1,2],[4],[6..n-1]] (0-based). Raises ValueError if invalid."""
    groups = []
    for part in (spec or "").replace(" ", "").split(","):
        if not part:
            continue
        try:
            if "-" in part:
                a, b = part.split("-", 1)
                start = int(a) if a else 1
                end = int(b) if b else n_pages
            else:
                start = end = int(part)
        except ValueError:
            raise ValueError(f"'{part}' is not a page or range like 1-3.") from None
        if start < 1 or end > n_pages or start > end:
            raise ValueError(f"Range '{part}' is outside pages 1-{n_pages}.")
        groups.append(list(range(start - 1, end)))
    if not groups:
        raise ValueError("No page ranges given.")
    return groups
