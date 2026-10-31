"""merge: combine several PDFs in the order the files were selected."""
from pathlib import Path

from pypdf import PdfWriter

from app.core.pdf_utils import open_pdf
from app.core.tooling import Output, RunContext, ToolResult, ToolSpec


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    order = params.get("order")  # optional: indexes into the selected files
    idx = list(order) if order else list(range(len(inputs)))
    writer = PdfWriter()
    counts = []
    for i in idx:
        reader = open_pdf(inputs[i], params.get("password"))
        start = len(writer.pages)
        writer.append(reader)
        counts.append(len(reader.pages))
        if params.get("bookmarks", True):
            writer.add_outline_item(Path(ctx.filenames[i]).stem, start)
    name = params.get("filename") or "merged.pdf"
    out = ctx.work_dir / name
    with open(out, "wb") as f:
        writer.write(f)
    total = len(writer.pages)
    return ToolResult(
        ok=True,
        message=f"Merged {len(idx)} files into {total} pages.",
        outputs=[Output(out, name, "application/pdf")],
        data={"pages": total, "input_pages": counts},
    )


TOOL = ToolSpec(
    id="merge",
    name="Merge PDFs",
    tier="standard",
    adobe_feature="organize PDFs",
    description="Combine several PDFs into one, in the order they were selected.",
    params_schema={
        "type": "object",
        "properties": {
            "order": {"type": "array", "items": {"type": "integer"}, "description": "Optional 0-based order of the selected files"},
            "bookmarks": {"type": "boolean", "default": True, "description": "Add a bookmark per source file"},
            "filename": {"type": "string", "default": "merged.pdf"},
        },
    },
    run=run,
    min_files=2,
)
