"""OCR: turn scanned pages into a searchable PDF (Acrobat Pro: "Turn scans into editable PDFs").

Pages that already carry text are copied unchanged unless params["force"] is true.
"""
from __future__ import annotations

import time
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from .pdfio import image_to_pdf_page, page_text, render_page
from .result import fail, ok


def run(inputs: list[Path], params: dict, out_dir: Path) -> dict:
    if len(inputs) != 1:
        return fail("OCR takes exactly one PDF.")
    src = Path(inputs[0])
    dpi = int(params.get("dpi", 300))
    force = bool(params.get("force", False))
    started = time.time()

    reader = PdfReader(str(src))
    writer = PdfWriter()
    done, skipped = [], []
    for i, page in enumerate(reader.pages):
        if not force and page_text(src, i).strip():
            writer.add_page(page)
            skipped.append(i + 1)
            continue
        size = (float(page.mediabox.width), float(page.mediabox.height))
        img = render_page(src, i, dpi)
        writer.add_page(PdfReader(BytesIO(image_to_pdf_page(img, dpi, True, size))).pages[0])
        done.append(i + 1)

    out = Path(out_dir) / f"{src.stem}-searchable.pdf"
    with open(out, "wb") as f:
        writer.write(f)
    secs = round(time.time() - started, 2)
    msg = f"Recognised text on {len(done)} page(s); {len(skipped)} already had text."
    return ok(msg, [out], {"pages_ocr": done, "pages_skipped": skipped, "seconds": secs})
