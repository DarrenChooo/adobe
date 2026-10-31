"""annotate: text boxes, images, highlights, comments, whiteout-and-retype.

Highlights and comments are real PDF annotations (they show in Chrome's and
Acrobat's comment tools). Text boxes, images and whiteout are drawn into the
page so every viewer shows them the same way.

Each item: {kind, page (1-based), x, y, w, h (fractions, top-left origin), ...}
  text:      text, font_size?, color?
  image:     image (PNG/JPEG data URL)
  whiteout:  text? (the retyped replacement), font_size?
  highlight: color? (default yellow)
  comment:   text (shown in the note), author?
"""
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Highlight, Text
from pypdf.generic import ArrayObject, FloatObject, NameObject, TextStringObject

from app.core.pdf_utils import open_pdf
from app.core.stamp import apply_stamps
from app.core.tooling import Output, RunContext, ToolError, ToolResult, ToolSpec

DRAWN = {"text", "image", "whiteout", "rect"}
ANNOTS = {"highlight", "comment"}


def _hex_rgb(h: str) -> list[float]:
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def _rect(page, it: dict) -> tuple[float, float, float, float]:
    cb = page.cropbox
    pw, ph = float(cb.width), float(cb.height)
    x0 = float(cb.left) + float(it["x"]) * pw
    x1 = x0 + float(it.get("w", 0.03)) * pw
    y1 = float(cb.bottom) + ph - float(it["y"]) * ph
    y0 = y1 - float(it.get("h", 0.03)) * ph
    return x0, y0, x1, y1


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    items = params.get("items") or []
    if not items:
        raise ToolError("Add at least one annotation.")
    bad = [i.get("kind") for i in items if i.get("kind") not in DRAWN | ANNOTS]
    if bad:
        raise ToolError(f"Unknown annotation kind(s): {bad}")

    src = inputs[0]
    open_pdf(src, params.get("password"))  # fail early on a locked file
    drawn = [i for i in items if i["kind"] in DRAWN]
    stage = ctx.work_dir / "stage.pdf"
    if drawn:
        apply_stamps(src, stage, drawn, params.get("password"))
    else:
        stage.write_bytes(src.read_bytes())

    reader = PdfReader(str(stage))
    writer = PdfWriter(clone_from=reader)
    added = 0
    for it in items:
        if it["kind"] not in ANNOTS:
            continue
        pidx = int(it.get("page", 1)) - 1
        if not 0 <= pidx < len(writer.pages):
            raise ToolError(f"Page {pidx + 1} doesn't exist.")
        page = writer.pages[pidx]
        x0, y0, x1, y1 = _rect(page, it)
        if it["kind"] == "highlight":
            quad = ArrayObject([FloatObject(v) for v in (x0, y1, x1, y1, x0, y0, x1, y0)])
            annot = Highlight(rect=(x0, y0, x1, y1), quad_points=quad, highlight_color=it.get("color", "ffff00").lstrip("#"))
            annot[NameObject("/CA")] = FloatObject(0.5)
        else:
            annot = Text(rect=(x0, y1 - 20, x0 + 20, y1), text=str(it.get("text", "")), open=False)
            annot[NameObject("/C")] = ArrayObject([FloatObject(v) for v in _hex_rgb(it.get("color", "#ffd400"))])
            annot[NameObject("/Name")] = NameObject("/Comment")
        if it.get("author"):
            annot[NameObject("/T")] = TextStringObject(it["author"])
        if it.get("text") and it["kind"] == "highlight":
            annot[NameObject("/Contents")] = TextStringObject(it["text"])
        writer.add_annotation(page_number=pidx, annotation=annot)
        added += 1

    name = f"{Path(ctx.filenames[0]).stem}_annotated.pdf"
    out = ctx.work_dir / name
    with open(out, "wb") as f:
        writer.write(f)
    return ToolResult(
        ok=True,
        message=f"Added {len(drawn)} drawn item(s) and {added} annotation(s).",
        outputs=[Output(out, name, "application/pdf")],
        data={"drawn": len(drawn), "annotations": added},
    )


TOOL = ToolSpec(
    id="annotate",
    name="Edit & annotate",
    tier="standard",
    adobe_feature="edit … PDFs",
    description="Add text boxes, images, highlights, comments, or white out text and retype it.",
    params_schema={
        "type": "object",
        "required": ["items"],
        "properties": {
            "items": {
                "type": "array",
                "description": "Each: {kind: text|image|whiteout|highlight|comment, page, x, y, w, h (fractions of page, top-left), text?, image?, color?, font_size?}",
                "items": {"type": "object"},
            }
        },
    },
    run=run,
    min_files=1,
    max_files=1,
)
