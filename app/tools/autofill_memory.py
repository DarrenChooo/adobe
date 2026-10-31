"""Which forms Smart Autofill remembers, by name, so the profile page can list and forget them.

Smart Autofill (app/tools/autofill.py) saves the reviewed mapping per form in
autofill_cache.json, keyed by a hash of the form's field names. That file has no
form names, so after each fill the UI calls "note" here and we keep the name,
field count and time in our own autofill_forms.json. Profile values are never stored.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.storage import STORAGE_DIR
from app.core.tooling import RunContext, ToolError, ToolResult, ToolSpec
from app.tools import autofill

NOTES_PATH = STORAGE_DIR / "autofill_forms.json"
UNKNOWN_NAME = "A form you filled"


def _cache_path() -> Path:
    # Read at call time so it follows autofill.CACHE_PATH (tests swap it).
    return autofill.CACHE_PATH


def _load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    except (OSError, ValueError):
        return {}


def _save(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")


def note(signature: str, filename: str, fields) -> dict:
    count = len(fields) if isinstance(fields, (list, tuple, dict)) else int(fields or 0)
    notes = _load(NOTES_PATH)
    notes[signature] = {
        "name": Path(filename or "").name or UNKNOWN_NAME,
        "fields": count,
        "last_filled": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    _save(NOTES_PATH, notes)
    return notes[signature]


def list_forms() -> list[dict]:
    cache = _load(_cache_path())
    notes = _load(NOTES_PATH)
    forms = []
    for signature, entry in cache.items():
        info = notes.get(signature, {})
        mapping = (entry or {}).get("mapping") or {}
        forms.append({
            "signature": signature,
            "name": info.get("name") or UNKNOWN_NAME,
            "fields": info.get("fields") or len(mapping),
            "last_filled": info.get("last_filled"),
        })
    forms.sort(key=lambda f: f["last_filled"] or "", reverse=True)
    return forms


def forget(signature: str) -> bool:
    found = False
    for path in (_cache_path(), NOTES_PATH):
        if not path.exists():
            continue
        data = _load(path)
        if signature in data:
            del data[signature]
            _save(path, data)
            found = True
    return found


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    action = params.get("action", "list")
    if action == "list":
        forms = list_forms()
        return ToolResult(ok=True, message=f"{len(forms)} form(s) remembered.", data={"forms": forms})
    signature = str(params.get("signature") or "").strip()
    if not signature:
        raise ToolError("Which form? The signature is missing.")
    if action == "note":
        saved = note(signature, params.get("filename") or "", params.get("fields") or 0)
        return ToolResult(ok=True, message=f"Fill Me will remember {saved['name']}.", data={"form": {"signature": signature, **saved}})
    if action == "forget":
        found = forget(signature)
        return ToolResult(ok=True, message="Forgotten." if found else "Nothing to forget.", data={"forgotten": found})
    raise ToolError(f"Unknown action: {action}")


TOOL = ToolSpec(
    id="autofill_memory",
    name="Autofill memory",
    tier="ours",
    adobe_feature="Not in Acrobat",
    description="Lists the forms Smart Autofill remembers, by name, and forgets one on request. Never stores your details.",
    params_schema={
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["note", "list", "forget"], "default": "list"},
            "signature": {"type": "string", "description": "For note and forget: the form signature from autofill map"},
            "filename": {"type": "string", "description": "For note: the form's file name"},
            "fields": {"type": ["integer", "array"], "description": "For note: the number of fields (or the field list)"},
        },
    },
    run=run,
    min_files=0,
    max_files=0,
)
