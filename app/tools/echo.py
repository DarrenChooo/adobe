"""echo: returns the input unchanged. Proves the pipeline end to end."""
from pathlib import Path

from app.core.tooling import Output, RunContext, ToolResult, ToolSpec


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    outputs = [Output(path=p, filename=name) for p, name in zip(inputs, ctx.filenames)]
    return ToolResult(ok=True, message=f"Echoed {len(outputs)} file(s).", outputs=outputs, data={"params": params})


TOOL = ToolSpec(
    id="echo",
    name="Echo (test)",
    tier="ours",
    adobe_feature="Pipeline test, not an Adobe feature",
    description="Return the selected files unchanged. Used to check upload, run and download work.",
    params_schema={"type": "object", "properties": {}},
    run=run,
    min_files=1,
)
