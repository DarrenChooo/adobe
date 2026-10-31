"""Web forms (Acrobat Pro: "Create web forms").

Modes (params["mode"]):
  inspect     list a PDF's fillable fields
  create      turn a fillable PDF into a shareable web form -> form_id (page lives at /f/<form_id>)
  schema      the questions for a form_id (what the public page renders)
  submit      answers for a form_id -> a filled copy of the PDF + a stored response
  responses   every response for a form_id as a CSV
  add_fields  flat PDF + boxes the user drew -> a PDF with real fillable fields

Storage: <FILLME_STORAGE or ./storage>/webforms/<form_id>/{source.pdf, schema.json, responses.db, filled/}
Box coordinates are PDF points, top-left origin (same as redact).
"""
from __future__ import annotations

import csv
import json
import os
import shutil
import sqlite3
import time
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

from .result import fail, ok

RADIO_FLAG = 1 << 15
REQUIRED_FLAG = 1 << 1


def _root(params: dict) -> Path:
    base = Path(params.get("storage") or os.environ.get("FILLME_STORAGE", "storage"))
    root = base / "webforms"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _opt(o) -> str:
    if isinstance(o, (list, tuple)) and o:
        return str(o[-1])
    return str(o)


def inspect(src: Path) -> list[dict]:
    fields = PdfReader(str(src)).get_fields() or {}
    out = []
    for name, f in fields.items():
        ft, flags = f.get("/FT"), int(f.get("/Ff", 0) or 0)
        states = [str(s) for s in (f.get("/_States_") or []) if str(s) != "/Off"]
        if ft == "/Tx":
            kind = "text"
        elif ft == "/Btn":
            kind = "radio" if flags & RADIO_FLAG else "checkbox"
        elif ft == "/Ch":
            kind = "choice"
        elif ft == "/Sig":
            kind = "signature"
        else:
            kind = "unknown"
        if kind in ("signature", "unknown"):
            continue
        out.append({
            "name": name,
            "label": str(f.get("/TU") or name),
            "type": kind,
            "options": [_opt(o) for o in (f.get("/Opt") or [])] or [s.lstrip("/") for s in states if kind == "radio"],
            "on_value": states[0] if kind == "checkbox" and states else None,
            "required": bool(flags & REQUIRED_FLAG),
        })
    return out


def _db(form_dir: Path) -> sqlite3.Connection:
    con = sqlite3.connect(form_dir / "responses.db")
    con.execute("CREATE TABLE IF NOT EXISTS responses (id INTEGER PRIMARY KEY, submitted_at TEXT, answers TEXT, pdf TEXT)")
    return con


def fill(src: Path, schema: list[dict], answers: dict, out: Path) -> dict:
    """Fill a copy of src with answers. Returns the values actually written."""
    values = {}
    for f in schema:
        if f["name"] not in answers:
            continue
        a = answers[f["name"]]
        if f["type"] == "checkbox":
            values[f["name"]] = (f["on_value"] or "/Yes") if a in (True, "true", "on", "yes", "1", 1) else "/Off"
        elif f["type"] == "radio":
            values[f["name"]] = "/" + str(a).lstrip("/")
        else:
            values[f["name"]] = str(a)
    writer = PdfWriter(clone_from=str(src))
    for page in writer.pages:
        if "/Annots" in page:
            writer.update_page_form_field_values(page, values, auto_regenerate=False)
    writer.set_need_appearances_writer(True)
    with open(out, "wb") as fh:
        writer.write(fh)
    return values


def add_fields(src: Path, boxes: list[dict], out: Path) -> int:
    """Draw real AcroForm fields where the user drew boxes, then lay the original pages underneath."""
    reader = PdfReader(str(src))
    buf = BytesIO()
    c = canvas.Canvas(buf)
    for pno, page in enumerate(reader.pages, start=1):
        w, h = float(page.mediabox.width), float(page.mediabox.height)
        c.setPageSize((w, h))
        for b in (b for b in boxes if int(b.get("page", 1)) == pno):
            x, y = b["x0"], h - b["bottom"]
            bw, bh = b["x1"] - b["x0"], b["bottom"] - b["top"]
            name, label = b["name"], b.get("label", b["name"])
            if b.get("type") == "checkbox":
                c.acroForm.checkbox(name=name, tooltip=label, x=x, y=y, size=min(bw, bh), forceBorder=True)
            else:
                c.acroForm.textfield(name=name, tooltip=label, x=x, y=y, width=bw, height=bh,
                                     borderWidth=1, forceBorder=True, fontSize=10)
        c.showPage()
    c.save()
    writer = PdfWriter(clone_from=BytesIO(buf.getvalue()))
    for i, page in enumerate(writer.pages):
        page.merge_page(reader.pages[i], over=False)  # original content goes UNDER the new fields
    writer.set_need_appearances_writer(True)
    with open(out, "wb") as fh:
        writer.write(fh)
    return len(boxes)


def run(inputs: list[Path], params: dict, out_dir: Path) -> dict:
    mode = params.get("mode", "inspect")
    out_dir = Path(out_dir)

    if mode == "inspect":
        if len(inputs) != 1:
            return fail("Choose one PDF.")
        fields = inspect(Path(inputs[0]))
        return ok(f"Found {len(fields)} fillable field(s).", [], {"fields": fields})

    if mode == "create":
        if len(inputs) != 1:
            return fail("Choose one fillable PDF.")
        src = Path(inputs[0])
        fields = inspect(src)
        if not fields:
            return fail("This PDF has no fillable fields. Use 'add_fields' first to draw some.")
        form_id = uuid.uuid4().hex[:8]
        d = _root(params) / form_id
        (d / "filled").mkdir(parents=True)
        shutil.copy(src, d / "source.pdf")
        schema = {"form_id": form_id, "title": params.get("title") or src.stem, "fields": fields,
                  "created_at": datetime.now().isoformat(timespec="seconds")}
        (d / "schema.json").write_text(json.dumps(schema, indent=2))
        _db(d).close()
        return ok(f"Web form ready with {len(fields)} question(s).", [], {**schema, "share_path": f"/f/{form_id}"})

    form_id = params.get("form_id", "")
    d = _root(params) / form_id
    if mode in ("schema", "submit", "responses") and not (form_id and (d / "schema.json").exists()):
        return fail("That form doesn't exist. Check the link.")

    if mode == "schema":
        return ok("Form loaded.", [], json.loads((d / "schema.json").read_text()))

    if mode == "submit":
        schema = json.loads((d / "schema.json").read_text())
        answers = params.get("answers") or {}
        missing = [f["label"] for f in schema["fields"] if f["required"] and not str(answers.get(f["name"], "")).strip()]
        if missing:
            return fail("Please fill in: " + ", ".join(missing), {"missing": missing})
        con = _db(d)
        n = (con.execute("SELECT COALESCE(MAX(id), 0) FROM responses").fetchone()[0] or 0) + 1
        filled = d / "filled" / f"response-{n:03d}.pdf"
        fill(d / "source.pdf", schema["fields"], answers, filled)
        con.execute("INSERT INTO responses (id, submitted_at, answers, pdf) VALUES (?, ?, ?, ?)",
                    (n, datetime.now().isoformat(timespec="seconds"), json.dumps(answers), str(filled)))
        con.commit()
        con.close()
        out = out_dir / f"{schema['title']}-response-{n:03d}.pdf"
        shutil.copy(filled, out)
        return ok(f"Thanks, response {n} saved.", [out], {"response_id": n})

    if mode == "responses":
        schema = json.loads((d / "schema.json").read_text())
        names = [f["name"] for f in schema["fields"]]
        con = _db(d)
        rows = con.execute("SELECT id, submitted_at, answers FROM responses ORDER BY id").fetchall()
        con.close()
        out = out_dir / f"{schema['title']}-responses.csv"
        with open(out, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["response", "submitted_at"] + [f["label"] for f in schema["fields"]])
            for rid, at, ans in rows:
                a = json.loads(ans)
                w.writerow([rid, at] + [a.get(n, "") for n in names])
        return ok(f"{len(rows)} response(s).", [out], {"count": len(rows)})

    if mode == "add_fields":
        if len(inputs) != 1:
            return fail("Choose one PDF.")
        boxes = params.get("boxes") or []
        if not boxes or any(not b.get("name") for b in boxes):
            return fail("Draw at least one box and give every box a name.")
        src = Path(inputs[0])
        out = out_dir / f"{src.stem}-fillable.pdf"
        started = time.time()
        n = add_fields(src, boxes, out)
        return ok(f"Added {n} fillable field(s).", [out], {"fields": inspect(out), "seconds": round(time.time() - started, 2)})

    return fail(f"Unknown mode '{mode}'.")
