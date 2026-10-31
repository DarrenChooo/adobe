"""ToolSpec, ToolResult, the registry, and the run wrapper. See SPEC 5.1."""
from __future__ import annotations

import importlib
import logging
import mimetypes
import pkgutil
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

log = logging.getLogger("fillme.tools")


@dataclass
class Output:
    path: Path
    filename: str | None = None
    mime: str | None = None


@dataclass
class ToolResult:
    ok: bool
    message: str = ""
    outputs: list[Any] = field(default_factory=list)  # Output or {path, filename, mime}
    data: dict = field(default_factory=dict)


@dataclass
class RunContext:
    """Passed to every tool's run() as `ctx`. Write outputs into `work_dir`."""
    work_dir: Path
    file_ids: list[str]
    filenames: list[str]


@dataclass
class ToolSpec:
    id: str
    name: str
    tier: str  # standard | pro | studio | ours
    adobe_feature: str
    description: str
    params_schema: dict
    run: Callable[[list[Path], dict, RunContext], ToolResult]
    min_files: int = 0
    max_files: int | None = None
    status: str = "works"  # works | partial | not-yet (shown on /coverage)

    def public(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "tier": self.tier,
            "adobe_feature": self.adobe_feature,
            "description": self.description,
            "params_schema": self.params_schema,
            "min_files": self.min_files,
            "max_files": self.max_files,
            "status": self.status,
        }


class ToolError(Exception):
    """Raise from a tool for a clean, user-facing error message."""


REGISTRY: dict[str, ToolSpec] = {}
LOAD_ERRORS: dict[str, str] = {}


def discover(package: str = "app.tools") -> dict[str, ToolSpec]:
    """Import every module in app/tools/ that defines TOOL. A broken tool file is
    logged and skipped so one person's bug can't take the whole app down."""
    pkg = importlib.import_module(package)
    for mod in pkgutil.iter_modules(pkg.__path__):
        if mod.name.startswith("_"):
            continue
        name = f"{package}.{mod.name}"
        try:
            m = importlib.import_module(name)
        except Exception:
            LOAD_ERRORS[mod.name] = traceback.format_exc()
            log.error("Failed to load tool %s:\n%s", name, LOAD_ERRORS[mod.name])
            continue
        spec = getattr(m, "TOOL", None)
        if isinstance(spec, ToolSpec):
            REGISTRY[spec.id] = spec
    return REGISTRY


def normalize_outputs(result: ToolResult) -> list[Output]:
    outs = []
    for o in result.outputs:
        if isinstance(o, dict):
            o = Output(path=Path(o["path"]), filename=o.get("filename"), mime=o.get("mime"))
        o.path = Path(o.path)
        o.filename = o.filename or o.path.name
        o.mime = o.mime or mimetypes.guess_type(o.filename)[0] or "application/octet-stream"
        outs.append(o)
    return outs


def run_tool(spec: ToolSpec, inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    """Run a tool and never raise: errors come back as ok=False with a message."""
    n = len(inputs)
    if n < spec.min_files:
        return ToolResult(ok=False, message=f"{spec.name} needs at least {spec.min_files} file(s); got {n}.")
    if spec.max_files is not None and n > spec.max_files:
        return ToolResult(ok=False, message=f"{spec.name} takes at most {spec.max_files} file(s); got {n}.")
    try:
        result = spec.run(inputs, params or {}, ctx)
    except (ToolError, ValueError) as e:
        return ToolResult(ok=False, message=str(e))
    except Exception as e:  # noqa: BLE001
        log.exception("Tool %s failed", spec.id)
        return ToolResult(ok=False, message=f"{type(e).__name__}: {e}")
    if not isinstance(result, ToolResult):
        return ToolResult(ok=False, message=f"Tool {spec.id} returned {type(result).__name__}, not ToolResult.")
    return result
