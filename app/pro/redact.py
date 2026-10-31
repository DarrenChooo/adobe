"""Redaction (Acrobat Pro: "Redact sensitive content").

Modes (params["mode"]):
  detect  find Singapore NRIC/FIN, SG phone numbers, emails and SG addresses; return boxes, no file
  apply   black out detected + manual boxes with TRUE removal: each affected page is
          rebuilt from a picture with the boxes painted in, so the text is gone from
          the file, then re-OCR'd so the rest of the page stays searchable
  audit   check ANY PDF for text hidden under black boxes (the naive-redaction trap)

Coordinates are PDF points, top-left origin (pdfplumber convention).
"""
from __future__ import annotations

import time
from io import BytesIO
from pathlib import Path

import pdfplumber
from PIL import ImageDraw
from pypdf import PdfReader, PdfWriter

from .pdfio import all_text, image_to_pdf_page, render_page
from .result import fail, ok

PATTERNS = {
    # "$" is included because OCR often misreads a leading S as $ (seen on our own scan sample).
    "nric": r"(?<![A-Za-z0-9])[STFGMstfgm$]\d{7}[A-Za-z](?![A-Za-z0-9])",
    "phone": r"(?<![\d+])(?:\+65[\s-]?)?[3689]\d{3}[\s-]?\d{4}(?!\d)",
    "email": r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+",
}

# Singapore addresses. One alternation so a full address ("Blk 123 Example Street 45, #06-78,
# Singapore 123456") becomes ONE box; a lone unit number or postal code is still caught on its own.
_STREET_TYPE = (r"(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Lane|Ln|Crescent|Cres|Walk|Way|Close|Place|Pl|"
                r"Link|Central|Rise|Hill|View|Park|Terrace|Grove|Boulevard|Square|Sq|Loop|Vale|Green)")
_STREET_NAME = rf"(?:[A-Z][A-Za-z']*\s+){{1,4}}{_STREET_TYPE}\b(?:\s+\d{{1,3}}[A-Z]?)?"
# "Bik"/"B1k" are common OCR misreads of "Blk" (seen on our phone-photo sample).
_BLOCK = r"(?:Blk|Bik|B1k|Block)\s*\d{1,4}[A-Z]?"
_UNIT = r"#\d{1,3}-\d{1,5}[A-Z]?"
_POSTAL = r"(?:Singapore\s*\d{6}(?!\d)|S\s?\(\d{6}\)|(?<![A-Za-z0-9])S\d{6}(?![A-Za-z0-9]))"
_FULL = (rf"(?:{_BLOCK}\s+{_STREET_NAME}|\d{{1,4}}[A-Z]?\s+{_STREET_NAME})"
         rf"(?:,?\s*{_UNIT})?(?:,?\s*{_POSTAL})?")
PATTERNS["address"] = rf"{_FULL}|{_UNIT}|{_POSTAL}"
PAD = 1.5  # points of padding around each detected box


def detect(src: Path, types: list[str] | None = None) -> list[dict]:
    types = types or list(PATTERNS)
    hits: list[dict] = []
    with pdfplumber.open(str(src)) as pdf:
        for pno, page in enumerate(pdf.pages, start=1):
            for kind in types:
                for m in page.search(PATTERNS[kind], regex=True, case=True):
                    hits.append({
                        "id": f"p{pno}-{len(hits) + 1}", "page": pno, "type": kind, "text": m["text"],
                        "x0": m["x0"] - PAD, "top": m["top"] - PAD, "x1": m["x1"] + PAD, "bottom": m["bottom"] + PAD,
                    })
    return _dedupe(hits)


def _dedupe(hits: list[dict]) -> list[dict]:
    """Drop a hit fully inside another on the same page (e.g. a phone number inside an email)."""
    keep = []
    for h in hits:
        inside = any(
            o is not h and o["page"] == h["page"] and o["x0"] <= h["x0"] and o["x1"] >= h["x1"]
            and o["top"] <= h["top"] and o["bottom"] >= h["bottom"] and (o["x1"] - o["x0"]) > (h["x1"] - h["x0"])
            for o in hits
        )
        if not inside:
            keep.append(h)
    return keep


def _is_dark(color) -> bool:
    if color is None:
        return False
    if isinstance(color, (int, float)):
        color = (color,)
    c = [float(v) for v in color]
    if len(c) == 1:
        return c[0] < 0.25
    if len(c) == 3:
        return max(c) < 0.25
    if len(c) == 4:  # CMYK
        cc, m, y, k = c
        return k > 0.75 or min(cc, m, y) > 0.75
    return False


def audit(src: Path) -> list[dict]:
    """Find text that sits under filled dark rectangles: visually hidden, still in the file."""
    found = []
    with pdfplumber.open(str(src)) as pdf:
        for pno, page in enumerate(pdf.pages, start=1):
            boxes = [r for r in page.rects if r.get("fill") and _is_dark(r.get("non_stroking_color"))]
            for r in boxes:
                chars = [
                    ch for ch in page.chars
                    if r["x0"] <= (ch["x0"] + ch["x1"]) / 2 <= r["x1"] and r["top"] <= (ch["top"] + ch["bottom"]) / 2 <= r["bottom"]
                ]
                text = "".join(ch["text"] for ch in chars).strip()
                if text:
                    found.append({"page": pno, "hidden_text": text,
                                  "box": {k: round(r[k], 1) for k in ("x0", "top", "x1", "bottom")}})
    return found


def run(inputs: list[Path], params: dict, out_dir: Path) -> dict:
    if len(inputs) != 1:
        return fail("Redaction takes exactly one PDF.")
    src = Path(inputs[0])
    mode = params.get("mode", "detect")

    if mode == "audit":
        found = audit(src)
        if found:
            return ok(f"Found {len(found)} black box(es) with readable text still underneath.", [], {"hidden": found})
        return ok("No text found hidden under black boxes.", [], {"hidden": []})

    # A scan has no text to search, so recognise it first and redact the searchable copy.
    ocr_first = False
    if mode in ("detect", "apply") and not any(t.strip() for t in all_text(src)):
        from . import ocr as ocr_tool
        pre = ocr_tool.run([src], {"dpi": 300}, out_dir)
        if not pre["ok"]:
            return fail("This looks like a scan and text recognition failed, so nothing could be detected.")
        src, ocr_first = Path(pre["outputs"][0]["path"]), True

    hits = detect(src, params.get("types"))
    if mode == "detect":
        return ok(f"Found {len(hits)} item(s) to redact.", [], {"hits": hits, "ocr_first": ocr_first})
    if mode != "apply":
        return fail(f"Unknown mode '{mode}'. Use detect, apply or audit.")

    excluded = set(params.get("exclude", []))
    boxes = [h for h in hits if h["id"] not in excluded] + [
        {**b, "id": f"manual-{i + 1}", "type": "manual", "text": ""} for i, b in enumerate(params.get("extra_boxes", []))
    ]
    if not boxes:
        return fail("Nothing to redact: no detected items and no boxes drawn.")

    dpi = int(params.get("dpi", 200))
    reocr = bool(params.get("ocr", True))
    started = time.time()
    reader = PdfReader(str(src))
    writer = PdfWriter()
    pages_hit = sorted({b["page"] for b in boxes})
    for i, page in enumerate(reader.pages, start=1):
        if i not in pages_hit:
            writer.add_page(page)
            continue
        size = (float(page.mediabox.width), float(page.mediabox.height))
        img = render_page(src, i - 1, dpi)
        draw = ImageDraw.Draw(img)
        s = dpi / 72
        for b in (b for b in boxes if b["page"] == i):
            draw.rectangle([b["x0"] * s, b["top"] * s, b["x1"] * s, b["bottom"] * s], fill="black")
        writer.add_page(PdfReader(BytesIO(image_to_pdf_page(img, dpi, reocr, size))).pages[0])

    out = Path(out_dir) / f"{src.stem}-redacted.pdf"
    with open(out, "wb") as f:
        writer.write(f)

    # Leak test: none of the redacted strings may be extractable from the output.
    out_text = "\n".join(all_text(out))
    squashed = out_text.replace(" ", "")
    leaked = sorted({b["text"] for b in boxes if b["text"] and b["text"].replace(" ", "") in squashed})
    data = {
        "redacted": len(boxes), "pages_rebuilt": pages_hit, "by_type": _count(boxes),
        "leak_test": "pass" if not leaked else "fail", "leaked": leaked, "seconds": round(time.time() - started, 2),
        "ocr_first": ocr_first,
    }
    msg = f"Redacted {len(boxes)} item(s) on {len(pages_hit)} page(s). Leak test: {data['leak_test']}."
    return ok(msg, [out], data)


def _count(boxes: list[dict]) -> dict:
    out: dict[str, int] = {}
    for b in boxes:
        out[b["type"]] = out.get(b["type"], 0) + 1
    return out
