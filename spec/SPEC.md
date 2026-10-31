# Build Spec: Fill Me

**Fill Me** is a free, MIT-licensed, open-source alternative to every paid tier of Adobe Acrobat, plus smart autofill.

Status: written 31 Oct 2026. Stack, language, AI provider, name and licence are decided (section 8). Items still marked **[DECIDE]** need the team's yes.
Track: NUS Hackers, Autonomous SG 2026 ("Pick an opaque app, service, device, or system. Figure out how it works, then use what you uncover to build something even better.").

Each person hands **this file plus their own brief** to their coding agent:
- `BRIEF-A-platform-standard.md`: Person A, platform and Standard-tier tools
- `BRIEF-B-pro-tools.md`: Person B, Pro-tier tools
- `BRIEF-C-ai-studio.md`: Person C, Studio-tier AI tools and smart autofill

---

## 1. What we are building, in one paragraph

A free, open-source web app that does what people pay Adobe Acrobat for, across **every paid tier** (Standard, Pro, Studio). It runs on your own machine, so your documents stay with you. Only the AI features call out to a language model, and they send the least data possible. On top of Adobe's feature list we add **smart autofill**: fill any PDF form from a saved profile, where the AI only sees the form's field names, never your personal details.

## 2. The status quo we are replacing (checked on adobe.com, 31 Oct 2026, US prices)

| Plan | Annual plan, paid monthly | Per year (prepaid) | Monthly, no contract |
|---|---|---|---|
| Acrobat Standard | US$14.99/mo (one page only, recheck) | US$179.88 | US$24.99 |
| Acrobat Pro | US$19.99/mo | US$239.88 | US$29.99 |
| Acrobat Studio | US$24.99/mo (one page only, recheck) | US$299.88 | US$34.99 |
| Pro for teams | US$23.99/mo per licence | US$287.88 | |
| AI Assistant Plus add-on | US$4.99/mo (shown on the Pro page) | | |

Sources: https://www.adobe.com/acrobat/pricing.html and https://www.adobe.com/acrobat/acrobat-pro.html. Singapore prices may differ.
**Not yet sourced:** how many people use Acrobat. The pitch owner finds an official Adobe figure before anyone quotes one.

## 3. Feature coverage: every paid Acrobat feature mapped to an owner

Adobe's wording is quoted. "Our version" is the honest one-day version. Priority: **P0** = must work in the demo, **P1** = should ship, **P2** = stretch.

| # | Adobe tier | Adobe feature (their words) | Our version | Owner | Pri |
|---|---|---|---|---|---|
| 1 | Standard | "Create ... PDFs" | Images to PDF; text or Markdown to PDF | A | P0 |
| 2 | Standard | "edit ... PDFs" | Add text boxes, images, highlights, comments, whiteout-and-retype. Not true in-place text editing | A | P1 |
| 3 | Standard | "convert, export" | PDF to Word, Excel (tables), images, plain text; images to PDF; Office to PDF only if LibreOffice is installed | B | P0 |
| 4 | Standard | "organize PDFs" | Merge, split, reorder, rotate, delete, extract pages | A | P0 |
| 5 | Standard | "Collect e-signatures and track responses" | Signing request link, signer signs in browser, status page (sent / viewed / signed), audit log | A | P0 |
| 6 | Standard | "Fill, sign" | Fill form fields by hand; draw or type a signature and place it | A | P0 |
| 7 | Standard | "password-protect PDFs" | AES-256 password and permissions; unlock with the known password | A | P0 |
| 8 | Pro | "Redact sensitive content" | Auto-detect Singapore NRIC/FIN, phone, email, address and names, plus manual boxes. **True removal** (page rebuilt, nothing hidden under the box) | B | P0 |
| 9 | Pro | "Create web forms" | Turn a PDF's fields into a shareable web form; responses written back into a filled PDF; add fillable fields to a flat PDF | B | P1 |
| 10 | Pro | "Turn scans into editable PDFs" | OCR scanned pages into a searchable PDF with a text layer | B | P0 |
| 11 | Pro | "Compare versions of a PDF" | Text diff per page plus visual diff highlighting changed areas | B | P0 |
| 12 | Pro | Reusable e-sign templates | Save signature-field positions as a template | A | P1 |
| 13 | Pro | Bulk e-signature requests | Upload a CSV of signers and send one request each | A | P1 |
| 14 | Pro | Logo and custom URL on agreements | Branding settings applied to the signing page | A | P2 |
| 15 | Studio | "Ask AI to edit, convert, and compress PDFs" | Plain-English command bar ("merge these and compress") that picks and runs our real tools | C | P0 |
| 16 | Studio | "Get summaries, insights, and answers" | Summary plus Q&A where every answer cites page numbers, and the AI refuses when the document doesn't say | C | P0 |
| 17 | Studio | "Organize, share, and collaborate with PDF Spaces" | A "Space" of several PDFs with cross-document Q&A and shared notes | C | P1 |
| 18 | Studio | "Generate flyers, social content, and presentations from documents" | Turn a PDF into a slide deck (.pptx) and a one-page flyer | C | P1 |
| 19 | Pro/Std | Compress (part of "70+ tools") | Downsample images, compress streams, report size before and after | A | P1 |
| 20 | **Ours** | Not in Acrobat | **Smart autofill**: saved profile fills any PDF form; the AI sees field names and profile *keys* only, never values | C | P0 |
| 21 | **Ours** | Not in Acrobat | Context rules on the profile (e.g. Singapore passport: visa-free destinations from a curated table) | C | P2 |
| 22 | **Ours** | Not in Acrobat | Chrome extension using the same autofill mapper on web forms | C | P2 |

**Not doing (say so if asked):** legally certified e-signatures (no digital certificate authority), layout-perfect Word conversion, editing existing text in place, XFA (dynamic Adobe) forms, mobile apps.

## 4. What we uncovered (the answer to the judges' question)

Each workstream collects one or two concrete findings about how Acrobat or PDFs work inside, with a screenshot or sample file:
- **A:** how a PDF stores pages and form fields (the page tree, AcroForm field names like `/T` and `/TU`), and what "password-protected" actually encrypts.
- **B:** why a black box drawn over text is not redaction (the text is still in the file and can be copied out), and how OCR adds an invisible text layer to a scan.
- **C:** how a form's hidden field names map to human meanings, which is what lets one profile fill forms it has never seen.

## 5. Architecture (stack DECIDED 31 Oct: Python FastAPI + React)

**Stack:** a Python FastAPI server that does all the PDF work, plus a React front end built with Vite, all running locally.
- **Front-end language:** TypeScript (decided).
- **AI provider:** SoCLaaS, NUS School of Computing's free language-model service (decided). It speaks the OpenAI chat-completions format at `https://soclaas-api.comp.nus.edu.sg/v1`, so `app/core/llm.py` uses a standard OpenAI-compatible client. Base URL, model and key come from environment variables. That means anyone outside NUS can point Fill Me at another OpenAI-compatible endpoint, including a local model, with no code change.
- **During development:** two processes run side by side:
  - `uvicorn app.main:app --reload` for the server on port 8000
  - `npm run dev` inside `frontend/` for the page on port 5173, which forwards `/api` and `/files` calls to port 8000 through Vite's proxy setting
- **For the demo:** `npm run build`, then FastAPI serves `frontend/dist/`, so it's one process and one address.
- **Why Python for the server:** its PDF libraries cover passwords, OCR and tables, which JavaScript's don't do well.

How information flows:
1. The user uploads a PDF in the browser. The server stores it and returns a **file id**.
2. The user picks a tool and sets options. The browser calls that tool with the file id(s) and options.
3. The tool does the work locally with PDF libraries and saves the output as a new file, which gets its own id.
4. The browser shows the result and offers a download.
5. AI tools (Person C) follow the same route. The command bar asks the language model *which* tool to run with *which* options, then calls the real tool. The model never edits the PDF itself.

```
React (frontend/) --upload-->    POST /api/files            -> file_id
                --run tool-> POST /api/tools/{tool_id}  -> outputs [file_id...] + data
                --download-> GET  /api/files/{file_id}
AI command bar  -> LLM picks tool + params -> same POST /api/tools/{tool_id}
```

### 5.1 Shared contract (everyone must follow this exactly)

**Repo layout**
```
app/main.py                       A  FastAPI app; auto-discovers tools; serves frontend/dist/ in demo mode
app/core/storage.py               A  save/load files by id (folder: storage/, git-ignored)
app/core/tooling.py               A  ToolSpec, registry, run wrapper
app/core/pdf_utils.py             A  shared helpers (open, render page to image, text with positions)
app/core/llm.py                   C  the one place that talks to the language model
app/tools/<tool_id>.py            owner  one file per tool (server side)
frontend/package.json             A  shared: append dependencies only
frontend/vite.config.ts           A  dev proxy /api and /files -> :8000
frontend/src/App.tsx              A  shell: upload, file list, tool picker, preview, router
frontend/src/api.ts               A  typed fetch helpers (upload, runTool, listTools, fileUrl)
frontend/src/components/          A  shared UI: FileDropzone, PdfPreview (react-pdf), ResultPanel
frontend/src/tools/registry.ts    A  auto-collects every tool file (no edits needed when you add one)
frontend/src/tools/<tool_id>.tsx  owner  one UI file per tool
tests/test_<tool_id>.py           owner
samples/                    all   small test PDFs (no real personal data)
docs/findings/              all   "what we uncovered" notes and screenshots
```

**Backend tool interface.** Every `app/tools/<tool_id>.py` exposes one object:
```python
TOOL = ToolSpec(
    id="merge",                     # lowercase, matches filename
    name="Merge PDFs",
    tier="standard",                # standard | pro | studio | ours
    adobe_feature="organize PDFs",  # row in section 3, for the coverage page
    description="Combine several PDFs into one, in order.",
    params_schema={...},            # JSON Schema for options (the AI router reads this)
    run=run,                        # def run(inputs: list[Path], params: dict, ctx) -> ToolResult
)
```
`ToolResult` = `{ok: bool, message: str, outputs: [{path, filename, mime}], data: dict}`.

**HTTP API (built by A in hour one, then frozen)**
- `POST /api/files` (multipart `file`) -> `{file_id, filename, pages, size}`
- `GET /api/files/{file_id}` -> the file
- `GET /api/tools` -> list of every ToolSpec minus `run` (powers the tool picker, the AI router and the coverage page)
- `POST /api/tools/{tool_id}` body `{"file_ids": [...], "params": {...}}` -> `{ok, message, outputs: [{file_id, filename, mime}], data}`

**Front-end tool interface.** Each `frontend/src/tools/<tool_id>.tsx` default-exports one object:
```tsx
import type { ToolUI } from "./registry";
const tool: ToolUI = {
  id: "merge",                                   // must match the server tool id
  Panel: ({ selectedFileIds, api, onResult }) => { /* options form; await api.runTool("merge", selectedFileIds, params); onResult(res) */ },
  routes: [],                                    // optional extra pages, e.g. { path: "/sign/:id", element: <SignPage/> }
};
export default tool;
```
`registry.ts` collects them with `import.meta.glob("./*.tsx", { eager: true })`, so nobody edits a shared list. `App.tsx` adds every tool's `routes` to the router automatically.

### 5.2 Rules for every agent
- **Licences: permissive only** (MIT, BSD, Apache-2.0, MPL-2.0). **Banned:** PyMuPDF/fitz (AGPL), pdf2docx (depends on PyMuPDF), Ghostscript (AGPL), iText (AGPL), poppler and anything needing it, such as pdf2image (GPL).
- **Front-end libraries:** React, Vite, react-router, react-pdf (all MIT). Keep styling simple (plain CSS or one small library the team agrees on); don't add a heavy design system mid-day.
- **Suggested server libraries:** pypdf (BSD: pages, forms, encryption), pypdfium2 (Apache/BSD: render pages, text with positions), pdfplumber (MIT: text and tables), reportlab (BSD: draw onto and create PDFs), Pillow (HPND: images), pytesseract + Tesseract (Apache: OCR), python-docx, openpyxl, python-pptx (MIT).
- **Privacy:** files never leave the machine except for text a Person C tool sends to the model, and that is the minimum needed. Never send profile *values* to the model.
- **Stay in your lane:** only edit files you own (see your brief). Shared files are `requirements.txt` and `frontend/package.json` (append dependencies only) and `samples/`. Ask before touching anything else.
- **No real personal data** in `samples/` or tests. Use made-up names and NRICs that fit the format.
- Every tool ships with one sample input in `samples/` and one test that runs it.
- Commit small, pull often. Branch per person (`a/...`, `b/...`, `c/...`), merge to `main` at every checkpoint.

## 6. Timeline (relative to start; fill in real clock times) **[DECIDE: end time]**

| When | Everyone |
|---|---|
| H0:00-H0:45 | A: server scaffold + React app scaffold, contract, a dummy `echo` tool working end to end in the browser, pushed to `main`. B and C: install Python and Node dependencies, collect sample PDFs, write their first server tool as a plain function and test it from the command line until A pushes |
| H0:45 | **Checkpoint 1:** everyone pulls `main` and runs the echo tool |
| H3:00 | **Checkpoint 2:** every P0 tool runs from the command line; merge |
| H5:00 | **Checkpoint 3 / go-no-go:** every P0 tool works in the browser. Anything not working is cut or moved to P2 |
| End -1:30 | **Feature freeze.** Only fixes, numbers, README, demo video |
| End -0:30 | Rehearse the demo twice; backup video recorded |

## 7. Evidence and numbers (worth 45% of the rubric between cost and cost reduction)

Each owner produces measured numbers for their tools. Never guess them:
- **A:** time to merge, split and protect a sample file; compression size before and after.
- **B:** OCR accuracy on a scan where the right text is known; redaction: how many planted fake NRICs and phone numbers were caught out of the total, plus a "copy-paste leak test" (pass = no hidden text left); compare: planted edits found out of the total.
- **C:** autofill: fields filled correctly out of the total, on real public blank forms; Q&A: answers with correct page citations out of a set of questions with known answers, plus refusals on questions the document can't answer; AI cost per operation (tokens times the model's price).
- **Pitch owner:** Adobe price per user per year (section 2) vs ours: US$0 software, and US$0 AI on SoCLaaS (free, rate-limited). For users outside NUS, show measured tokens per operation so they can price it on any provider. Also the sourced Acrobat user figure.

A **coverage page** (`/coverage`, built by A from `GET /api/tools`) shows section 3 live: each Adobe feature, our tool, and whether it works. That's the demo's opening shot.

## 8. Open decisions (team, before H0:30)

1. **DECIDED 31 Oct: stack = Python FastAPI + React (Vite), front end in TypeScript.**
2. **DECIDED 31 Oct: AI provider = SoCLaaS** (free, OpenAI-compatible). Each person running AI features needs their own SoCLaaS key in a git-ignored `.env`. **[CHECK]** that every teammate who runs Person C's tools can get a key. Nobody has read SoCLaaS's privacy page yet, so demo with made-up personal data only.
3. **DECIDED 31 Oct: name = "Fill Me".**
4. **DECIDED 31 Oct: licence = MIT.** `LICENSE` file in hour one (Person A).
5. **[DECIDE] Who is A, B, C**, and who owns the pitch numbers. A = Darren Choo (31 Oct). B, C and the pitch owner still to fill in.
6. **[ASK ORGANISERS]** hackathon end time, demo length, and whether code written before today is allowed.
