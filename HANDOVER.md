# Handover: Acrobat-style frontend rebuild (branch `b/acrobat-ui`)

Last updated: 31 Oct 2026, 14:45 SGT (wrap-up snapshot; helpers told to stop). Submission deadline 16:15 SGT.

## What this branch is
A ground-up rebuild of the frontend so it works like Adobe Acrobat. Server code and the HTTP API are
unchanged, except for one new tool file (`app/tools/autofill_memory.py`, see below). `main` still has the
old frontend and is the safe demo fallback. Merge only after every tool has been clicked through.

## Layout (see `frontend/src/App.tsx` header for URLs)
- **Top bar:** ☰ menu (slide-out side menu), logo, Home tab, one tab per open document, then print,
  download and the AI Assistant button (inside a document) or a tool search box (elsewhere).
- **Home pages** (side menu): Home (Smart Autofill first, recommended tools, drop a file, recent files),
  All tools (by category, with Standard / Pro / Studio / Fill Me only badges), Recent files, Agreements,
  PDF Spaces, My autofill profile, Coverage.
- **Document view** `/doc/<fileId>?tool=<id>&ai=1`: left pane = All tools list, or the chosen tool's
  settings; middle = the PDF (a tool can draw on it via `<Stage>`); right = page thumbnails, or the AI
  Assistant panel. Results show a message at the top and open as a new tab.
- **Start a tool from Home:** `/pick/<toolId>` asks for a file, then opens it with the tool ready.
- **Setup-page tools** `/tool/<toolId>`: Combine files, Compare files, Create a PDF.

## How a tool screen plugs in (`frontend/src/tools/registry.ts`)
Each `tools/<id>.tsx` default-exports `{ id, Pane?, Page?, routes? }`:
`Pane` (works on the open document, gets `file` and `Stage`), `Page` (own setup page),
`routes` (`frame: "home"` = inside the side menu; `"none"` = bare page for outsiders, e.g. `/sign/:id`, `/f/:id`).
Shared look: building-block classes in `frontend/src/styles.css`. Names, icons, categories: `frontend/src/shell/catalog.tsx`.

## Files
- Frame (done, typechecked, browser-checked 14:39): `frontend/src/App.tsx`, `frontend/src/shell/*`,
  `frontend/src/styles.css`, `frontend/src/tools/registry.ts`, `components/useRun.ts`, `components/FileDropzone.tsx`,
  `components/PdfPreview.tsx`, `components/SchemaForm.tsx`, `Coverage.tsx`, `tools/echo.tsx`.
- Tool screens (being rewritten in parallel at 14:42; status per tool below).

## Status per tool (14:45)
| Tool | Status |
|---|---|
| Combine, Compress, Split, Organize pages, Create a PDF, Protect, Remove a password, Export, Scan & OCR | DONE: each ran end to end through the new frame and was checked by screenshot. Office-to-PDF (in Create) needs LibreOffice installed; it shows the server's message without it. |
| Redact, Prepare a web form, Edit & comment, Fill & Sign, Request e-signatures + Agreements page | IN PROGRESS at snapshot; see the commit after this one for the helper's final status. |
| Smart Autofill + profile page, autofill_memory, AI Assistant, Ask AI to do it, Generate, PDF Spaces, Compare | IN PROGRESS at snapshot; see the commit after this one for the helper's final status. |

## Known open issues
1. **Opening a document by direct link to a file the browser has never seen sticks on "Opening…"** (seen 14:43 with
   `/doc/<id>?tool=unlock` on a password-protected PDF in a fresh browser). The server answers the info request in 5 ms.
   The browser logs "Can't perform a React state update on a component that hasn't mounted yet". Cause NOT yet found;
   look at the info-fetch effect in `frontend/src/shell/DocumentView.tsx` (it should also add the fetched file to the
   frame's file list so the tab shows its name instead of "Document"). Opening files from Home, Recent or a tool works.
2. Password-protected PDFs: the centre view now hands them to the PDF preview so it can say "password-protected,
   unlock it first"; untested because of issue 1.
3. Whole-branch typecheck and build not yet run clean (helpers were mid-edit at the snapshot).

## Autofill memory (new, does not touch Person C's code)
`app/tools/autofill_memory.py` reads C's `storage/autofill_cache.json` and keeps its own
`storage/autofill_forms.json` (form name, field count, last filled; never profile values).
Actions: `note`, `list`, `forget`. Used by the profile page's "Forms Fill Me remembers" list.

## To run
```
.venv/bin/uvicorn app.main:app --port 8000          # backend
cd frontend && npm run dev                          # http://localhost:5173 (proxies /api to :8000)
```
Or `cd frontend && npm run build`, then the backend serves the built app on :8000.

## Before merging to main
1. `cd frontend && npm run typecheck && npm run build` with zero errors.
2. `.venv/bin/python -m pytest -q` passes.
3. Click through every tool once on a fresh browser (no saved state).
4. Check the demo flow: redact (audit the naive PDF, find on the phone photo, draw a box, redact for real, audit the output) and autofill (match, fill, open the same form again: "Remembered").
