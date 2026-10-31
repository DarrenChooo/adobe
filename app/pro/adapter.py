"""Plugs a Person B tool into Person A's registry (app.core.tooling.ToolSpec)."""
from __future__ import annotations

from pathlib import Path
from types import ModuleType

from app.core.tooling import RunContext, ToolResult, ToolSpec

from .specs import SPECS


def make_tool(tool_id: str, impl: ModuleType, min_files: int, max_files: int | None,
              fixed_params: dict | None = None, status: str = "works") -> ToolSpec:
    def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
        params = dict(params or {})
        if fixed_params:
            params.update(fixed_params)  # server-side values the request can't override
        r = impl.run(inputs, params, ctx.work_dir)
        return ToolResult(ok=r["ok"], message=r["message"], outputs=r["outputs"], data=r["data"])

    return ToolSpec(id=tool_id, run=run, min_files=min_files, max_files=max_files, status=status, **SPECS[tool_id])
