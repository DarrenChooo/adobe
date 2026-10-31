"""unlock: remove a PDF's password when you know it."""
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from app.core.tooling import Output, RunContext, ToolError, ToolResult, ToolSpec


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    reader = PdfReader(str(inputs[0]))
    if not reader.is_encrypted:
        raise ToolError("This PDF isn't password-protected.")
    result = reader.decrypt(params.get("password") or "")
    if not result:
        raise ToolError("Wrong password.")
    writer = PdfWriter(clone_from=reader)
    name = f"{Path(ctx.filenames[0]).stem.removesuffix('_protected')}_unlocked.pdf"
    out = ctx.work_dir / name
    with open(out, "wb") as f:
        writer.write(f)
    return ToolResult(
        ok=True,
        message="Password removed.",
        outputs=[Output(out, name, "application/pdf")],
        data={"matched": result.name.lower()},  # 'user' or 'owner' password
    )


TOOL = ToolSpec(
    id="unlock",
    name="Unlock PDF",
    tier="standard",
    adobe_feature="password-protect PDFs",
    description="Remove the password from a PDF, given the correct password.",
    params_schema={
        "type": "object",
        "required": ["password"],
        "properties": {"password": {"type": "string"}},
    },
    run=run,
    min_files=1,
    max_files=1,
)
