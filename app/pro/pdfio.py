"""Shared PDF helpers for Person B's tools.

Coordinates follow pdfplumber: PDF points (1/72 inch), origin at the
top-left of the page, so `top` grows downwards.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
import pytesseract
from PIL import Image
from pypdf import PdfReader


def page_count(pdf_path: Path) -> int:
    return len(PdfReader(str(pdf_path)).pages)


def render_page(pdf_path: Path, index: int, dpi: int = 200) -> Image.Image:
    """Render one page to an RGB image at the given resolution."""
    doc = pdfium.PdfDocument(str(pdf_path))
    try:
        img = doc[index].render(scale=dpi / 72).to_pil().convert("RGB")
    finally:
        doc.close()
    return img


def page_text(pdf_path: Path, index: int) -> str:
    with pdfplumber.open(str(pdf_path)) as pdf:
        return pdf.pages[index].extract_text() or ""


def all_text(pdf_path: Path) -> list[str]:
    with pdfplumber.open(str(pdf_path)) as pdf:
        return [(p.extract_text() or "") for p in pdf.pages]


def image_to_pdf_page(img: Image.Image, dpi: int, ocr: bool, size_pt: tuple[float, float]) -> bytes:
    """Turn a page image back into a one-page PDF of the original size.

    With ocr=True, Tesseract adds an invisible text layer so the page stays
    searchable. Either way the visible page is just the image, so nothing
    painted over in the image can be recovered from the file.
    """
    if ocr:
        data = pytesseract.image_to_pdf_or_hocr(img, lang="eng", extension="pdf", config=f"--dpi {dpi}")
    else:
        buf = BytesIO()
        img.save(buf, format="PDF", resolution=dpi)
        data = buf.getvalue()
    return _fit_to_size(data, size_pt)


def _fit_to_size(one_page_pdf: bytes, size_pt: tuple[float, float]) -> bytes:
    from pypdf import PdfWriter

    reader = PdfReader(BytesIO(one_page_pdf))
    page = reader.pages[0]
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    tw, th = size_pt
    if abs(w - tw) > 0.5 or abs(h - th) > 0.5:
        page.scale_to(tw, th)
    writer = PdfWriter()
    writer.add_page(page)
    out = BytesIO()
    writer.write(out)
    return out.getvalue()
