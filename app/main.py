"""Fill Me server. Run: uvicorn app.main:app --reload

The four endpoints below are the frozen contract from SPEC 5.1. Tools are
auto-discovered from app/tools/*.py (any module that defines TOOL).
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.core import storage
from app.core.pdf_utils import page_count
from app.core.tooling import LOAD_ERRORS, REGISTRY, RunContext, discover, normalize_outputs, run_tool

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Fill Me", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

discover()


class RunBody(BaseModel):
    file_ids: list[str] = Field(default_factory=list)
    params: dict = Field(default_factory=dict)


def _file_info(file_id: str) -> dict:
    p = storage.get_path(file_id)
    m = storage.meta(file_id)
    return {"file_id": file_id, "filename": m["filename"], "pages": page_count(p), "size": p.stat().st_size}


@app.post("/api/files")
async def upload_file(file: UploadFile = File(...)):
    data = await file.read()
    file_id = storage.save_bytes(data, file.filename or "upload", file.content_type)
    return _file_info(file_id)


@app.get("/api/files/{file_id}")
@app.get("/files/{file_id}")
def get_file(file_id: str, download: bool = False):
    try:
        p = storage.get_path(file_id)
        m = storage.meta(file_id)
    except KeyError:
        raise HTTPException(404, "No such file") from None
    return FileResponse(
        p,
        media_type=m.get("mime") or None,
        filename=m["filename"],
        content_disposition_type="attachment" if download else "inline",
    )


@app.get("/api/files/{file_id}/info")
def file_info(file_id: str):
    """Extra (not in the frozen four): metadata for a file id."""
    try:
        return _file_info(file_id)
    except KeyError:
        raise HTTPException(404, "No such file") from None


@app.get("/api/tools")
def list_tools():
    return [t.public() for t in sorted(REGISTRY.values(), key=lambda t: (t.tier, t.id))]


@app.get("/api/tools/_errors")
def tool_errors():
    """Tool files that failed to import, so a broken file is visible, not silent."""
    return LOAD_ERRORS


@app.post("/api/tools/{tool_id}")
def call_tool(tool_id: str, body: RunBody):
    spec = REGISTRY.get(tool_id)
    if spec is None:
        raise HTTPException(404, f"No tool '{tool_id}'")
    try:
        inputs = [storage.get_path(fid) for fid in body.file_ids]
    except KeyError as e:
        raise HTTPException(404, f"No such file: {e.args[0]}") from None
    ctx = RunContext(
        work_dir=storage.work_dir(tool_id),
        file_ids=list(body.file_ids),
        filenames=[storage.meta(fid)["filename"] for fid in body.file_ids],
    )
    result = run_tool(spec, inputs, body.params, ctx)
    outputs = []
    if result.ok:
        for o in normalize_outputs(result):
            fid = storage.save_path(o.path, o.filename, o.mime)
            outputs.append({"file_id": fid, "filename": storage.meta(fid)["filename"], "mime": o.mime})
    return JSONResponse({"ok": result.ok, "message": result.message, "outputs": outputs, "data": result.data})


# Demo mode: serve the built React app (npm run build) from the same address.
DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith(("api/", "files/")) or path in ("api", "files"):
            raise HTTPException(404, "Not found")
        target = (DIST / path).resolve()
        if path and target.is_file() and DIST.resolve() in target.parents:
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
