"""organize: reorder, rotate, delete and extract pages.

Either pass `pages` (the final page list, in order, each an int or
{page, rotate}) as the thumbnail UI does, or the simpler `delete` /
`rotate` + `rotate_pages` / `extract` options the AI router can use.
"""
from pathlib import Path

from pypdf import PdfWriter

from app.core.pdf_utils import open_pdf, parse_ranges
from app.core.tooling import Output, RunContext, ToolError, ToolResult, ToolSpec


def _plan(params: dict, n: int) -> list[tuple[int, int]]:
    if params.get("pages"):
        plan = []
        for p in params["pages"]:
            page, rot = (p, 0) if isinstance(p, int) else (int(p["page"]), int(p.get("rotate", 0)))
            if not 1 <= page <= n:
                raise ToolError(f"Page {page} doesn't exist (the PDF has {n}).")
            plan.append((page - 1, rot))
        return plan
    keep = list(range(n))
    if params.get("extract"):
        keep = [i for g in parse_ranges(params["extract"], n) for i in g]
    if params.get("delete"):
        gone = {i for g in parse_ranges(params["delete"], n) for i in g}
        keep = [i for i in keep if i not in gone]
    rot = int(params.get("rotate") or 0)
    targets = set(range(n))
    if rot and params.get("rotate_pages"):
        targets = {i for g in parse_ranges(params["rotate_pages"], n) for i in g}
    return [(i, rot if i in targets else 0) for i in keep]


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    reader = open_pdf(inputs[0], params.get("password"))
    n = len(reader.pages)
    plan = _plan(params, n)
    if not plan:
        raise ToolError("That would leave no pages.")
    w = PdfWriter()
    for i, rot in plan:
        page = w.add_page(reader.pages[i])
        if rot % 360:
            if rot % 90:
                raise ToolError("Rotation must be a multiple of 90.")
            page.rotate(rot)
    name = f"{Path(ctx.filenames[0]).stem}_organized.pdf"
    out = ctx.work_dir / name
    with open(out, "wb") as f:
        w.write(f)
    return ToolResult(
        ok=True,
        message=f"{n} pages in, {len(plan)} pages out.",
        outputs=[Output(out, name, "application/pdf")],
        data={"order": [i + 1 for i, _ in plan], "rotations": [r for _, r in plan]},
    )


TOOL = ToolSpec(
    id="organize",
    name="Organize pages",
    tier="standard",
    adobe_feature="organize PDFs",
    description="Reorder, rotate, delete or extract pages of one PDF.",
    params_schema={
        "type": "object",
        "properties": {
            "pages": {
                "type": "array",
                "description": "Final page order (1-based). Items are page numbers or {page, rotate}. Pages left out are deleted.",
                "items": {"anyOf": [{"type": "integer"}, {"type": "object", "properties": {"page": {"type": "integer"}, "rotate": {"type": "integer"}}}]},
            },
            "delete": {"type": "string", "description": "Pages to delete, e.g. '2,4-5'"},
            "extract": {"type": "string", "description": "Keep only these pages, e.g. '1-3'"},
            "rotate": {"type": "integer", "enum": [0, 90, 180, 270], "description": "Clockwise rotation"},
            "rotate_pages": {"type": "string", "description": "Pages to rotate (default all), e.g. '1,3'"},
        },
    },
    run=run,
    min_files=1,
    max_files=1,
)
