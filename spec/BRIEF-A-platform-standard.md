# Brief A: Platform and Standard-tier tools

Read `SPEC.md` first. It holds the shared contract, the rules and the timeline. This brief is your part only.
Owner: ______  Branch prefix: `a/`

## Your job in one line
Build the app everyone else plugs into, then the Standard-tier tools Adobe charges US$14.99/mo and up for.

## Hour one: unblock the team (P0, do this before anything else)
Others are waiting on you. Push to `main` by **H0:45**:
1. `app/main.py`: FastAPI app that serves `web/`, auto-imports every `app/tools/*.py` that defines `TOOL`, and exposes the four endpoints in SPEC 5.1.
2. `app/core/storage.py`: save uploads and outputs under `storage/<file_id>/` (git-ignore `storage/`); look up by id.
3. `app/core/tooling.py`: `ToolSpec`, `ToolResult`, registry, a run wrapper that catches errors and returns `{ok: false, message}`.
4. `app/core/pdf_utils.py`: `open_pdf`, `page_count`, `render_page_png(path, page, dpi)` (pypdfium2), `text_with_boxes(path, page)` (pypdfium2 or pdfplumber). B and C rely on these.
5. `web/index.html` + `web/js/api.js` + `web/js/registry.js`: upload, file list, tool picker built from `GET /api/tools`, options panel, result panel with download, PDF preview (pdf.js from a CDN is fine).
6. `app/tools/echo.py` + `web/tools/echo.js`: returns the input unchanged. Proves the pipeline.
7. `requirements.txt`, `README.md` (how to run), `.gitignore`, `LICENSE` (team's chosen licence), `samples/` with 2-3 small made-up PDFs, one of them with form fields.
8. One command to run: `uvicorn app.main:app --reload`.

**Acceptance:** a teammate can clone, install, run, upload a PDF, run `echo`, and download the result.

## Your tools (each = `app/tools/<id>.py` + `web/tools/<id>.js` + `tests/test_<id>.py`)

| Tool id | SPEC row | Pri | What it does | Done when |
|---|---|---|---|---|
| `merge` | 4 | P0 | Combine several PDFs in the chosen order | Output page count = sum of inputs |
| `split` | 4 | P0 | Split by ranges ("1-3,5") or every N pages | One output per range |
| `organize` | 4 | P0 | Reorder, rotate, delete, extract pages | Thumbnail order in the UI matches output |
| `create` | 1 | P0 | Images to PDF; text/Markdown to PDF (reportlab) | Opens in any PDF viewer |
| `protect` | 7 | P0 | Add AES-256 password plus permissions (pypdf); `unlock` with a known password | Viewer asks for a password; wrong password fails |
| `fill_sign` | 6 | P0 | List form fields, fill them by hand; draw or type a signature and place it on a page | Filled values visible in Preview/Chrome; signature on the right page |
| `esign` | 5,12,13,14 | P0 (5), P1 (12,13), P2 (14) | Create a signing request (PDF plus signature box positions) and get a link. The signer opens it, draws a signature and submits. Status page shows sent / viewed / signed. Audit log (time, signer email, file hash). Templates = saved box positions. Bulk = CSV of signers, one link each. Branding = logo and colour on the signing page | Full loop works on one machine with two browser tabs |
| `annotate` | 2 | P1 | Add text box, image, highlight, comment, whiteout-and-retype | Annotations show in Chrome's viewer |
| `compress` | 19 | P1 | Recompress streams, downsample images (Pillow) | Report shows size before and after; output opens |
| coverage page | 7 | P0 | `/coverage` lists every tool from `GET /api/tools` grouped by Adobe tier, with a works/not-yet badge | Opening shot of the demo |

Storage for `esign`: SQLite in `storage/esign.db` is enough. No email sending: show the link to copy.

## What you uncover (SPEC section 4)
Write `docs/findings/a-pdf-internals.md` with screenshots:
- How a PDF stores its pages and form fields: open a sample with pypdf, print the field names (`/T`, `/TU`, `/FT`).
- What password protection actually encrypts, and what the permissions flags do or don't enforce.

## Numbers you produce (SPEC section 7)
Time for merge, split and protect on a sample; compression before/after sizes. Put them in `docs/findings/a-numbers.md`.

## Do not touch
Other people's `app/tools/*` and `web/tools/*` files. After H0:45, change the contract (API shape, ToolSpec fields) **only with the whole team's agreement**, because B and C build against it.
