"""Compare two versions of a PDF (Acrobat Pro: "Compare versions of a PDF").

Text: line-by-line diff across the whole document, labelled with page numbers.
Visual: render matching pages, find regions whose pixels differ, and output a
report PDF with version A on the left and version B on the right, changes boxed red.
"""
from __future__ import annotations

import difflib
import time
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

from .pdfio import all_text, page_count, render_page
from .result import fail, ok

CELL = 12          # px grid cell for grouping changed pixels
THRESHOLD = 40     # per-pixel difference (0-255) that counts as a change


def _lines(pages: list[str]) -> list[tuple[int, str]]:
    return [(pno, ln.strip()) for pno, txt in enumerate(pages, start=1) for ln in txt.splitlines() if ln.strip()]


def text_changes(a: Path, b: Path) -> list[dict]:
    la, lb = _lines(all_text(a)), _lines(all_text(b))
    sm = difflib.SequenceMatcher(a=[t for _, t in la], b=[t for _, t in lb], autojunk=False)
    changes = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        changes.append({
            "type": {"replace": "changed", "delete": "removed", "insert": "added"}[op],
            "page_a": la[i1][0] if i1 < len(la) else None,
            "page_b": lb[j1][0] if j1 < len(lb) else None,
            "before": [t for _, t in la[i1:i2]],
            "after": [t for _, t in lb[j1:j2]],
        })
    return changes


def changed_regions(img_a: Image.Image, img_b: Image.Image) -> list[tuple[int, int, int, int]]:
    """Boxes (px, in img_b's frame) around clusters of changed pixels."""
    if img_b.size != img_a.size:
        img_b = img_b.resize(img_a.size)
    diff = ImageChops.difference(img_a.convert("L"), img_b.convert("L")).point(lambda v: 255 if v > THRESHOLD else 0)
    w, h = diff.size
    cols, rows = (w + CELL - 1) // CELL, (h + CELL - 1) // CELL
    hot = set()
    for r in range(rows):
        for c in range(cols):
            if diff.crop((c * CELL, r * CELL, min(w, (c + 1) * CELL), min(h, (r + 1) * CELL))).getbbox():
                hot.add((r, c))
    boxes, seen = [], set()
    for cell in hot:  # flood-fill neighbouring hot cells into one box
        if cell in seen:
            continue
        stack, group = [cell], []
        seen.add(cell)
        while stack:
            r, c = stack.pop()
            group.append((r, c))
            for dr in (-1, 0, 1):
                for dc in (-3, -2, -1, 0, 1, 2, 3):  # reach further sideways so one word stays one box
                    n = (r + dr, c + dc)
                    if n in hot and n not in seen:
                        seen.add(n)
                        stack.append(n)
        rs, cs = [g[0] for g in group], [g[1] for g in group]
        boxes.append((min(cs) * CELL, min(rs) * CELL, min(w, (max(cs) + 1) * CELL), min(h, (max(rs) + 1) * CELL)))
    return sorted(boxes, key=lambda b: (b[1], b[0]))


def run(inputs: list[Path], params: dict, out_dir: Path) -> dict:
    if len(inputs) != 2:
        return fail("Compare takes exactly two PDFs: the old version first, the new version second.")
    a, b = Path(inputs[0]), Path(inputs[1])
    dpi = int(params.get("dpi", 100))
    started = time.time()

    changes = text_changes(a, b)
    na, nb = page_count(a), page_count(b)
    sheets, regions_per_page = [], {}
    for i in range(max(na, nb)):
        ia = render_page(a, i, dpi) if i < na else None
        ib = render_page(b, i, dpi) if i < nb else None
        base = ia or ib
        blank = Image.new("RGB", base.size, "white")
        ia, ib = ia or blank, (ib or blank).resize(base.size)
        boxes = changed_regions(ia, ib)
        regions_per_page[i + 1] = len(boxes)
        marked_a, marked_b = ia.copy(), ib.copy()
        for img in (marked_a, marked_b):
            d = ImageDraw.Draw(img)
            for x0, y0, x1, y1 in boxes:
                d.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], outline=(220, 30, 30), width=3)
        sheet = Image.new("RGB", (base.width * 2 + 20, base.height), "white")
        sheet.paste(marked_a, (0, 0))
        sheet.paste(marked_b, (base.width + 20, 0))
        sheets.append(sheet)

    out = Path(out_dir) / f"compare-{a.stem}-vs-{b.stem}.pdf"
    sheets[0].save(out, save_all=True, append_images=sheets[1:], resolution=dpi)
    total_regions = sum(regions_per_page.values())
    data = {
        "text_changes": changes, "text_change_count": len(changes),
        "visual_regions_per_page": regions_per_page, "visual_region_count": total_regions,
        "pages_a": na, "pages_b": nb, "seconds": round(time.time() - started, 2),
    }
    msg = f"{len(changes)} text change(s) and {total_regions} changed area(s) across {max(na, nb)} page(s)."
    return ok(msg, [out], data)
