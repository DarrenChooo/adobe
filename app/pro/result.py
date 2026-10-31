"""Result shape shared by Person B's tools (matches SPEC 5.1 ToolResult)."""
from __future__ import annotations

from pathlib import Path

MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
}


def output(path: Path) -> dict:
    return {"path": str(path), "filename": path.name, "mime": MIME.get(path.suffix.lower(), "application/octet-stream")}


def ok(message: str, outputs: list[Path] | None = None, data: dict | None = None) -> dict:
    return {"ok": True, "message": message, "outputs": [output(p) for p in (outputs or [])], "data": data or {}}


def fail(message: str, data: dict | None = None) -> dict:
    return {"ok": False, "message": message, "outputs": [], "data": data or {}}
