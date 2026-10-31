"""split: by page ranges ("1-3,5") or every N pages. One output per group."""
from pathlib import Path

from pypdf import PdfWriter

from app.core.pdf_utils import open_pdf, parse_ranges
from app.core.tooling import Output, RunContext, ToolError, ToolResult, ToolSpec


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    reader = open_pdf(inputs[0], params.get("password"))
    n = len(reader.pages)
    mode = params.get("mode") or ("ranges" if params.get("ranges") else "every")
    if mode == "ranges":
        groups = parse_ranges(params.get("ranges", ""), n)
    else:
        every = int(params.get("every") or 1)
        if every < 1:
            raise ToolError("'every' must be 1 or more.")
        groups = [list(range(i, min(i + every, n))) for i in range(0, n, every)]
    stem = Path(ctx.filenames[0]).stem
    outputs = []
    for g in groups:
        w = PdfWriter()
        for i in g:
            w.add_page(reader.pages[i])
        label = f"{g[0] + 1}" if len(g) == 1 else f"{g[0] + 1}-{g[-1] + 1}"
        name = f"{stem}_p{label}.pdf"
        out = ctx.work_dir / name
        with open(out, "wb") as f:
            w.write(f)
        outputs.append(Output(out, name, "application/pdf"))
    return ToolResult(
        ok=True,
        message=f"Split {n} pages into {len(outputs)} file(s).",
        outputs=outputs,
        data={"groups": [[i + 1 for i in g] for g in groups]},
    )


TOOL = ToolSpec(
    id="split",
    name="Split PDF",
    tier="standard",
    adobe_feature="organize PDFs",
    description="Split one PDF into several, by page ranges like 1-3,5 or every N pages.",
    params_schema={
        "type": "object",
        "properties": {
            "mode": {"type": "string", "enum": ["ranges", "every"], "default": "ranges"},
            "ranges": {"type": "string", "description": "Page ranges, 1-based, e.g. '1-3,5,7-'", "default": ""},
            "every": {"type": "integer", "minimum": 1, "default": 1, "description": "Pages per file when mode=every"},
        },
    },
    run=run,
    min_files=1,
    max_files=1,
)
