# Fill Me

A free, MIT-licensed, open-source alternative to every paid tier of Adobe Acrobat, plus smart autofill. It runs on your own machine, so your documents stay with you. See [`spec/SPEC.md`](spec/SPEC.md).

## Install

Needs Python 3.11+ and Node 20+.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && cd ..
cp .env.example .env   # only needed for the AI tools
```

## Run

**Dev** (two terminals):

```bash
uvicorn app.main:app --reload          # server on :8000
cd frontend && npm run dev             # page on http://localhost:5173 (proxies /api to :8000)
```

**Demo** (one process, one address):

```bash
cd frontend && npm run build && cd ..
uvicorn app.main:app                   # open http://localhost:8000
```

**Tests:** `pytest`

## Adding a tool (B and C: this is all you touch)

1. `app/tools/<id>.py` defines `TOOL = ToolSpec(...)` with a `run(inputs, params, ctx) -> ToolResult`. It is discovered automatically. Write outputs into `ctx.work_dir`. Raise `ToolError("message")` for a clean user-facing error.
2. `frontend/src/tools/<id>.tsx` default-exports a `ToolUI` (`{ id, Panel, routes? }`). It is discovered automatically. Without one, the app shows a form generated from `params_schema`.
3. `tests/test_<id>.py` using the `upload`, `run` and `fetch` fixtures in `tests/conftest.py`.

A broken tool file is skipped, not fatal: see `GET /api/tools/_errors`.

**Shared helpers you can use:**

- `app.core.pdf_utils`: `open_pdf`, `page_count`, `render_page_png`, `render_page_image`, `page_size`, `text_with_boxes`, `page_text`, `parse_ranges`
- `app.core.storage`: `get_path(file_id)`, `save_path(...)`, `work_dir()`
- `frontend/src/components`: `PdfPreview` (with an `overlay` and click handler for placing things on a page), `SignaturePad`, `FileDropzone`, `ResultPanel`, `SchemaForm`, and `useRun` (busy state plus error handling)

## API (frozen, SPEC 5.1)

| Method | Path | Returns |
|---|---|---|
| POST | `/api/files` (multipart `file`) | `{file_id, filename, pages, size}` |
| GET | `/api/files/{file_id}` (`?download=true` to force a download) | the file |
| GET | `/api/tools` | every ToolSpec minus `run` |
| POST | `/api/tools/{tool_id}` with `{file_ids, params}` | `{ok, message, outputs: [{file_id, filename, mime}], data}` |

Extras (additive, not part of the frozen four): `GET /api/files/{id}/info` and `GET /api/tools/_errors`.

## Person A tools

`merge`, `split`, `organize`, `create`, `protect`, `unlock`, `fill_sign`, `esign` (signing link, status, audit log, templates, bulk CSV, branding), `annotate`, `compress`, and the `/coverage` page.

## Licence

MIT. Copyright the Fill Me contributors.
