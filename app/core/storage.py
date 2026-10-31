"""Save and load files by id. Each file lives in storage/<file_id>/<filename>."""
from __future__ import annotations

import json
import os
import re
import shutil
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# FILLME_STORAGE lets tests use a throwaway folder instead of the real one.
STORAGE_DIR = Path(os.environ.get("FILLME_STORAGE") or ROOT / "storage")
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def _safe_name(filename: str) -> str:
    name = Path(filename or "file").name
    name = re.sub(r"[^\w.\- ()]+", "_", name).strip() or "file"
    return name[:200]


def _dir(file_id: str) -> Path:
    if not _ID_RE.match(file_id or ""):
        raise KeyError(file_id)
    return STORAGE_DIR / file_id


def _new(filename: str, mime: str | None) -> tuple[str, Path]:
    file_id = uuid.uuid4().hex
    d = STORAGE_DIR / file_id
    d.mkdir(parents=True)
    name = _safe_name(filename)
    (d / "meta.json").write_text(json.dumps({"filename": name, "mime": mime}))
    return file_id, d / name


def save_bytes(data: bytes, filename: str, mime: str | None = None) -> str:
    file_id, dest = _new(filename, mime)
    dest.write_bytes(data)
    return file_id


def save_path(path: Path, filename: str | None = None, mime: str | None = None) -> str:
    file_id, dest = _new(filename or path.name, mime)
    shutil.copyfile(path, dest)
    return file_id


def meta(file_id: str) -> dict:
    try:
        return json.loads((_dir(file_id) / "meta.json").read_text())
    except FileNotFoundError:
        raise KeyError(file_id) from None


def get_path(file_id: str) -> Path:
    """Path to the stored file. Raises KeyError if the id is unknown."""
    p = _dir(file_id) / meta(file_id)["filename"]
    if not p.exists():
        raise KeyError(file_id)
    return p


def work_dir(prefix: str = "run") -> Path:
    """A fresh scratch folder under storage/_work/ for a tool run."""
    d = STORAGE_DIR / "_work" / f"{prefix}-{uuid.uuid4().hex[:12]}"
    d.mkdir(parents=True)
    return d
