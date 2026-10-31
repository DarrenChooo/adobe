# Brief B: Pro-tier tools

Read `SPEC.md` first. It holds the shared contract, the rules and the timeline. This brief is your part only.
Owner: ______  Branch prefix: `b/`

## Your job in one line
Build the features that make people pay for Pro (US$19.99/mo, US$239.88/yr): OCR, convert/export, true redaction, compare, and web forms.

## Before A pushes the scaffold (H0:00-H0:45)
- Install Tesseract (Apache-2.0). On a Mac: `brew install tesseract`. **Ask first if it's not your machine.**
- Build `samples/` inputs you need: a scanned page (print a page and photograph it, or render a PDF page to an image), a PDF with made-up NRICs (format: S/T/F/G/M + 7 digits + letter, e.g. `S1234567D`), Singapore phone numbers (+65 8/9xxx xxxx), emails and an address; two versions of the same document with 5 planted edits; a flat form with no fields.
- Write your first tool as a plain function `run(inputs, params, ctx)` and test it from the command line. Wrap it in `TOOL = ToolSpec(...)` once A's `app/core/tooling.py` lands.

## Your tools (each = `app/tools/<id>.py` + `web/tools/<id>.js` + `tests/test_<id>.py`)

| Tool id | SPEC row | Pri | What it does | Done when |
|---|---|---|---|---|
| `ocr` | 10 | P0 | Render each page (pypdfium2), OCR with Tesseract, output a searchable PDF with an invisible text layer (`pytesseract.image_to_pdf_or_hocr(..., extension="pdf")`, then join pages with pypdf). Skip pages that already have text | You can search and copy text from the scanned sample |
| `convert` | 3 | P0 | PDF to Word (text and images in order via python-docx), PDF to Excel (tables via pdfplumber into openpyxl), PDF to PNG per page, PDF to plain text, images to PDF. Office to PDF only if `soffice` exists on the machine, otherwise say "LibreOffice not installed" | Each output opens in its app; tables land in cells |
| `redact` | 8 | P0 | **Detect:** regex for NRIC/FIN, SG phone, email; optional names and addresses via Person C's AI helper (only the page text is sent, and only if the user ticks "AI detect"). **Review:** show hits as boxes on the page; the user can untick or draw extra boxes. **Apply (true removal):** render each affected page to an image, paint black boxes, rebuild the page from the image, then OCR the result so the rest stays searchable. Unaffected pages stay untouched | Leak test passes: copying text from the output never returns a redacted value. Report shows hits found out of total planted |
| `compare` | 11 | P0 | Text diff per page (difflib) listing added and removed lines; visual diff: render both versions, subtract (Pillow), draw red boxes around changed regions; side-by-side view | Finds the planted edits; report shows found out of total planted |
| `webform` | 9 | P1 | **From a fillable PDF:** read its fields (pypdf) and generate a shareable web form page at `/f/<form_id>`. Each submission writes a filled copy of the PDF and a row in a responses table (SQLite in `storage/`). **For a flat PDF:** let the user draw boxes, name them, and add real fillable fields (reportlab `acroForm`, merged onto the page) | Submit the web form twice and get two filled PDFs plus a responses CSV download |

## What you uncover (SPEC section 4)
Write `docs/findings/b-redaction-and-ocr.md` with screenshots:
- **The black-box trap:** draw a black rectangle over text the naive way, then copy the "hidden" text out of it. That is the demo's "what we uncovered" moment. Then show that our output fails to leak.
- How OCR puts an invisible text layer behind a scanned image, and why that makes a scan searchable.

## Numbers you produce (SPEC section 7)
Put these in `docs/findings/b-numbers.md`:
- OCR accuracy on the scan whose text you know: characters or words correct out of the total.
- Redaction: planted values caught out of the total, plus leak-test pass or fail.
- Compare: planted edits found out of the total.
- Time per page for OCR and redaction.

## Do not touch
Anything under `app/core/` or `web/js/` (A owns it; ask A for a helper you need). Other people's tool files.
