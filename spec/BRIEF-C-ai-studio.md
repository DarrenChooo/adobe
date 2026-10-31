# Brief C: Studio-tier AI tools and smart autofill

Read `SPEC.md` first. It holds the shared contract, the rules and the timeline. This brief is your part only.
Owner: ______  Branch prefix: `c/`

## Your job in one line
Build what Adobe charges the most for (Studio, US$24.99/mo, or the AI Assistant Plus add-on, US$4.99/mo), plus our own headline feature, smart autofill. **Rule for every AI feature: the model decides and explains; our real tools do the work on the PDF.**

## Before A pushes the scaffold (H0:00-H0:45)
- **[DECIDE with team]** which model provider and whose API key. Keep the key in a `.env` file that is git-ignored. **Never commit it.**
- Write `app/core/llm.py` (you own this one file under `core/`): `complete(system, user, json_schema=None) -> dict|str`, one place to switch provider or point at a local model. Log tokens used per call, because you need cost per operation.
- Collect 5-10 **blank** public PDF forms with real fillable fields (e.g. government or airline forms anyone can download). Check each has fields (pypdf `get_fields()`); drop the ones that don't. Make a made-up profile JSON.

## Your tools (each = `app/tools/<id>.py` + `frontend/src/tools/<id>.tsx` + `tests/test_<id>.py`)

| Tool id | SPEC row | Pri | What it does | Done when |
|---|---|---|---|---|
| `autofill` | 20 | P0 | **Profile:** a local JSON of the user's details (name, NRIC, passport, address, phone, email, emergency contact...), edited in a profile page and stored in `storage/profile.json`. **Map:** read the form's fields (name `/T`, tooltip `/TU`, type, options) with pypdf. Send the model **only the field names/tooltips and the list of profile KEYS**, never the values. The model returns `{field -> profile_key or null, confidence}`. **Fill:** locally, with pypdf, from the real values. **Review screen:** each field, chosen key, value, confidence; the user fixes mistakes, and fixes are remembered per form (a cache keyed by the form's field-name signature = "it learns") | Fields correct out of the total on your real forms, measured and shown on screen |
| `assistant_qa` | 16 | P0 | **Summary**, plus **Q&A with citations**. Extract text per page (A's `text_with_boxes` or pdfplumber; run B's `ocr` first if a page has no text). Send page-numbered text; the model must answer with `[p.N]` citations and say "The document doesn't say" when it doesn't. Check every cited page number exists and that the quoted words appear on that page; flag any that fail | Correct citations on a question set with known answers; refuses questions the document can't answer |
| `assistant_command` | 15 | P0 | Plain-English command bar: "merge these two and compress", "redact all NRICs", "password-protect with 1234". Send the model the user's sentence plus `GET /api/tools` (ids, descriptions, params schemas). It returns a plan: a list of `{tool_id, params}`. Show the plan, the user clicks Run, and each step calls the real `POST /api/tools/{id}`, passing outputs forward. Validate params against the schema before running | Runs a 2-step plan built from A's and B's real tools |
| `spaces` | 17 | P1 | A Space = a named set of uploaded PDFs plus shared notes. Q&A across all of them with citations as `[file, p.N]` | Answer cites the right file and page |
| `generate` | 18 | P1 | From a PDF: a slide deck (.pptx via python-pptx: model writes an outline of titles and bullets, code builds the slides) and a one-page flyer (model writes the copy, code lays it out as a PDF with reportlab) | Files open in PowerPoint/Keynote and a PDF viewer |
| `context_rules` | 21 | P2 | Rules on top of the profile, from a **curated table you write and cite**, not the model's memory (e.g. Singapore passport: visa-free destinations). Shown as hints on the autofill review screen | Each hint shows its source |
| Chrome extension | 22 | P2 | Only if every P0 is done. Manifest V3 extension: reads input names, labels and autocomplete attributes on the current page, calls our local server's mapper, fills values | Fills one pre-tested real booking form |

Shared helper for Person B: expose `detect_pii(text) -> [{text, type}]` in `app/core/llm.py` for B's optional "AI detect" in `redact`.

## What you uncover (SPEC section 4)
Write `docs/findings/c-form-fields.md` with screenshots:
- Real forms' hidden field names, e.g. a field shown as "Surname" might be stored as `txtLName_1`. That gap is why browser autofill fails on PDFs and why mapping by meaning works.
- What the model is sent (field names and keys only) vs what stays on the machine (the values). That's the privacy story.

## Numbers you produce (SPEC section 7)
Put these in `docs/findings/c-numbers.md`:
- Autofill: fields correct out of the total per form and overall, plus how many the user had to fix.
- Q&A: correct citations out of total questions; correct refusals out of total unanswerable questions.
- Command bar: plans that ran correctly out of the commands tried.
- **Cost per operation:** tokens used times the model's published price per token (cite the pricing page).

## Do not touch
Anything under `app/core/` except `llm.py`, and anything in `frontend/src/` outside `frontend/src/tools/<your tool ids>.tsx` (A owns those). The profile page is a route your `autofill.tsx` exports (e.g. `/profile`). Other people's tool files.
