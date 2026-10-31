"""esign: signing requests with a link, status tracking and an audit log.

Everything goes through POST /api/tools/esign with params.action, so the frozen
API contract doesn't change. The request id doubles as the signer's secret link
token (/sign/<id>), as there's no email sending: the sender copies the link.

Sender actions:  create, bulk, list, status, cancel,
                 template_save, template_list, template_delete,
                 branding_get, branding_set
Signer actions:  open (marks viewed), sign
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.core import storage
from app.core.stamp import apply_stamps
from app.core.tooling import RunContext, ToolError, ToolResult, ToolSpec

DB = storage.STORAGE_DIR / "esign.db"

SCHEMA = """
create table if not exists requests (
  id text primary key, title text, message text, file_id text not null, file_hash text,
  signer_email text, signer_name text, fields text not null, status text not null,
  template_id text, batch_id text, signed_file_id text, signed_hash text,
  created_at text, viewed_at text, signed_at text
);
create table if not exists audit (
  id integer primary key autoincrement, request_id text, at text, event text, actor text, detail text
);
create table if not exists templates (id text primary key, name text, fields text, created_at text);
create table if not exists settings (key text primary key, value text);
"""


def _db() -> sqlite3.Connection:
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def _log(con, rid: str, event: str, actor: str, detail: dict | None = None):
    con.execute("insert into audit (request_id, at, event, actor, detail) values (?,?,?,?,?)",
                (rid, _now(), event, actor, json.dumps(detail or {})))


def _row(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["fields"] = json.loads(d["fields"])
    d["link"] = f"/sign/{d['id']}"
    return d


def _get(con, rid: str) -> sqlite3.Row:
    r = con.execute("select * from requests where id=?", (rid or "",)).fetchone()
    if r is None:
        raise ToolError("No such signing request. Check the link.")
    return r


def _branding(con) -> dict:
    r = con.execute("select value from settings where key='branding'").fetchone()
    return json.loads(r["value"]) if r else {"company": "", "color": "#d6342c", "logo": None, "public_url": ""}


def _with_urls(con, reqs: list[dict]) -> list[dict]:
    """Full signing URL per request, on the sender's custom address when one is set
    (Pro's "custom URL on agreements"). None means: use the page's own origin."""
    base = _branding(con).get("public_url") or ""
    for d in reqs:
        d["url"] = base + d["link"] if base else None
    return reqs


def _clean_url(url: str) -> str:
    url = (url or "").strip().rstrip("/")
    if url and not re.match(r"^https?://[^\s/]+(/[^\s]*)?$", url):
        raise ToolError("The custom URL must start with http:// or https://, e.g. https://sign.example.com")
    return url


def _validate_fields(fields: list[dict]) -> list[dict]:
    if not fields:
        raise ToolError("Place at least one signature box on the document.")
    out = []
    for f in fields:
        kind = f.get("kind", "signature")
        if kind not in ("signature", "date", "name", "initials"):
            raise ToolError(f"Unknown field kind '{kind}'.")
        out.append({"kind": kind, "page": int(f.get("page", 1)), "x": float(f["x"]), "y": float(f["y"]),
                    "w": float(f.get("w", 0.25)), "h": float(f.get("h", 0.06))})
    return out


# ---------- sender ----------

def _create(con, ctx: RunContext, inputs: list[Path], params: dict, signers: list[dict], batch_id: str | None = None) -> list[dict]:
    pdfs = [(p, fid) for p, fid in zip(inputs, ctx.file_ids) if p.suffix.lower() == ".pdf"]
    if len(pdfs) != 1:
        raise ToolError("Select exactly one PDF to send for signing.")
    src, file_id = pdfs[0]
    n_pages = len(PdfReader(str(src)).pages)
    fields = params.get("fields")
    tid = params.get("template_id")
    if not fields and tid:
        t = con.execute("select fields from templates where id=?", (tid,)).fetchone()
        if t is None:
            raise ToolError("No such template.")
        fields = json.loads(t["fields"])
    fields = _validate_fields(fields or [])
    if any(f["page"] > n_pages for f in fields):
        raise ToolError(f"A box is on a page past the end of the document ({n_pages} pages).")
    if params.get("save_template"):
        con.execute("insert into templates values (?,?,?,?)",
                    (uuid.uuid4().hex, params["save_template"], json.dumps(fields), _now()))
    file_hash = _sha256(src)
    title = params.get("title") or Path(ctx.filenames[ctx.file_ids.index(file_id)]).stem
    made = []
    for s in signers:
        email = (s.get("email") or "").strip()
        if "@" not in email:
            raise ToolError(f"'{email}' isn't an email address.")
        rid = uuid.uuid4().hex
        con.execute(
            "insert into requests (id,title,message,file_id,file_hash,signer_email,signer_name,fields,status,template_id,batch_id,created_at)"
            " values (?,?,?,?,?,?,?,?,?,?,?,?)",
            (rid, title, params.get("message", ""), file_id, file_hash, email, (s.get("name") or "").strip(),
             json.dumps(fields), "sent", tid, batch_id, _now()))
        _log(con, rid, "created", params.get("sender", "sender"), {"signer": email, "sha256": file_hash})
        made.append(_row(_get(con, rid)))
    return made


def _parse_csv(text: str) -> list[dict]:
    rows = list(csv.reader(io.StringIO(text.strip())))
    if not rows:
        raise ToolError("The CSV is empty.")
    head = [h.strip().lower() for h in rows[0]]
    if "email" in head:
        ei, ni = head.index("email"), head.index("name") if "name" in head else None
        body = rows[1:]
    else:  # no header: email[,name]
        ei, ni, body = 0, 1, rows
    out = []
    for r in body:
        if not r or not any(c.strip() for c in r):
            continue
        out.append({"email": r[ei].strip(), "name": r[ni].strip() if ni is not None and ni < len(r) else ""})
    if not out:
        raise ToolError("No signers found in the CSV.")
    return out


# ---------- signer ----------

def _certificate(req: dict, events: list[dict], signed_hash_note: str) -> bytes:
    """A one-page audit trail appended to the signed PDF."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 25 * mm
    c.setFont("Helvetica-Bold", 16)
    c.drawString(20 * mm, y, "Signature audit trail")
    y -= 10 * mm
    c.setFont("Helvetica", 10)
    for label, val in [
        ("Document", req["title"]), ("Request ID", req["id"]),
        ("Signer", f"{req['signer_name'] or ''} <{req['signer_email']}>".strip()),
        ("Original SHA-256", req["file_hash"]), ("Signed", req["signed_at"]), ("Note", signed_hash_note),
    ]:
        c.drawString(20 * mm, y, f"{label}:")
        c.drawString(55 * mm, y, str(val)[:95])
        y -= 6 * mm
    y -= 4 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Events (UTC)")
    y -= 7 * mm
    c.setFont("Helvetica", 9)
    for e in events:
        c.drawString(20 * mm, y, f"{e['at']}  {e['event']:<9}  {e['actor']}")
        y -= 5 * mm
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(20 * mm, 15 * mm, "Fill Me e-signature. Not a certified digital signature (no certificate authority).")
    c.showPage()
    c.save()
    return buf.getvalue()


def _sign(con, params: dict) -> dict:
    req = _get(con, params.get("request_id"))
    if req["status"] == "signed":
        raise ToolError("This document has already been signed.")
    if req["status"] == "cancelled":
        raise ToolError("The sender cancelled this request.")
    sig = params.get("signature")
    if not sig:
        raise ToolError("Draw or type your signature first.")
    name = (params.get("name") or req["signer_name"] or "").strip()
    src = storage.get_path(req["file_id"])
    if _sha256(src) != req["file_hash"]:
        raise ToolError("The document changed after the request was sent. Ask the sender for a new link.")
    initials = params.get("initials") or sig
    today = datetime.now().strftime("%d %b %Y")
    stamps = []
    for f in json.loads(req["fields"]):
        box = {k: f[k] for k in ("page", "x", "y", "w", "h")}
        if f["kind"] == "signature":
            stamps.append({**box, "kind": "image", "image": sig})
        elif f["kind"] == "initials":
            stamps.append({**box, "kind": "image", "image": initials})
        elif f["kind"] == "date":
            stamps.append({**box, "kind": "text", "text": today})
        elif f["kind"] == "name":
            stamps.append({**box, "kind": "text", "text": name})
    work = storage.work_dir("esign")
    stamped = work / "stamped.pdf"
    apply_stamps(src, stamped, stamps)

    signed_at = _now()
    con.execute("update requests set signer_name=? where id=?", (name, req["id"]))
    _log(con, req["id"], "signed", req["signer_email"], {"name": name})
    d = _row(_get(con, req["id"]))
    d["signed_at"] = signed_at
    events = [dict(e) for e in con.execute("select at, event, actor from audit where request_id=? order by id", (req["id"],))]
    writer = PdfWriter(clone_from=PdfReader(str(stamped)))
    writer.append(PdfReader(io.BytesIO(_certificate(d, events, "SHA-256 of this signed file is in the Fill Me audit log."))))
    writer.add_metadata({"/FillMeRequest": req["id"]})
    out = work / f"{d['title']}_signed.pdf"
    with open(out, "wb") as fh:
        writer.write(fh)
    signed_hash = _sha256(out)
    signed_id = storage.save_path(out, out.name, "application/pdf")
    con.execute("update requests set status='signed', signed_at=?, signed_file_id=?, signed_hash=? where id=?",
                (signed_at, signed_id, signed_hash, req["id"]))
    _log(con, req["id"], "completed", "system", {"signed_sha256": signed_hash})
    return _row(_get(con, req["id"]))


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    action = params.get("action", "create")
    con = _db()
    try:
        with con:
            if action == "create":
                signers = params.get("signers") or ([{"email": params.get("signer_email"), "name": params.get("signer_name")}] if params.get("signer_email") else [])
                if not signers:
                    raise ToolError("Add a signer email.")
                made = _create(con, ctx, inputs, params, signers)
                return ToolResult(ok=True, message=f"Created {len(made)} signing request(s). Copy the link to send it.", data={"requests": _with_urls(con, made)})
            if action == "bulk":
                text = params.get("csv")
                if not text:
                    csvs = [p for p in inputs if p.suffix.lower() == ".csv"]
                    if not csvs:
                        raise ToolError("Give a CSV of signers (email,name).")
                    text = csvs[0].read_text(encoding="utf-8-sig")
                batch = uuid.uuid4().hex[:8]
                made = _create(con, ctx, inputs, params, _parse_csv(text), batch)
                return ToolResult(ok=True, message=f"Created {len(made)} requests, one per signer (batch {batch}).", data={"requests": _with_urls(con, made), "batch_id": batch})
            if action == "list":
                rows = _with_urls(con, [_row(r) for r in con.execute("select * from requests order by created_at desc")])
                counts = {s: sum(r["status"] == s for r in rows) for s in ("sent", "viewed", "signed")}
                return ToolResult(ok=True, message=f"{len(rows)} request(s).", data={"requests": rows, "counts": counts})
            if action == "status":
                req = _with_urls(con, [_row(_get(con, params.get("request_id")))])[0]
                audit = [dict(a) | {"detail": json.loads(a["detail"])} for a in
                         con.execute("select at, event, actor, detail from audit where request_id=? order by id", (req["id"],))]
                return ToolResult(ok=True, message=f"Status: {req['status']}.", data={"request": req, "audit": audit})
            if action == "cancel":
                req = _get(con, params.get("request_id"))
                if req["status"] == "signed":
                    raise ToolError("Already signed; can't cancel.")
                con.execute("update requests set status='cancelled' where id=?", (req["id"],))
                _log(con, req["id"], "cancelled", "sender")
                return ToolResult(ok=True, message="Request cancelled.")
            if action == "open":
                req = _get(con, params.get("request_id"))
                if req["status"] == "sent":
                    con.execute("update requests set status='viewed', viewed_at=? where id=?", (_now(), req["id"]))
                if req["status"] in ("sent", "viewed"):
                    _log(con, req["id"], "viewed", req["signer_email"], {"user_agent": params.get("user_agent", "")[:200]})
                d = _row(_get(con, req["id"]))
                public = {k: d[k] for k in ("id", "title", "message", "file_id", "signer_email", "signer_name", "fields", "status", "signed_file_id")}
                return ToolResult(ok=True, message="", data={"request": public, "branding": _branding(con)})
            if action == "sign":
                d = _sign(con, params)
                return ToolResult(ok=True, message="Signed. The sender can see it now.", data={"request": d})
            if action == "template_save":
                if not params.get("name"):
                    raise ToolError("Name the template.")
                tid = uuid.uuid4().hex
                con.execute("insert into templates values (?,?,?,?)", (tid, params["name"], json.dumps(_validate_fields(params.get("fields") or [])), _now()))
                return ToolResult(ok=True, message=f"Saved template '{params['name']}'.", data={"template_id": tid})
            if action == "template_list":
                ts = [dict(t) | {"fields": json.loads(t["fields"])} for t in con.execute("select * from templates order by created_at desc")]
                return ToolResult(ok=True, message=f"{len(ts)} template(s).", data={"templates": ts})
            if action == "template_delete":
                con.execute("delete from templates where id=?", (params.get("template_id"),))
                return ToolResult(ok=True, message="Template deleted.")
            if action == "branding_get":
                return ToolResult(ok=True, message="", data={"branding": _branding(con)})
            if action == "branding_set":
                b = _branding(con)
                b.update({k: params[k] for k in ("company", "color", "logo") if k in params})
                if "public_url" in params:
                    b["public_url"] = _clean_url(params["public_url"])
                con.execute("insert or replace into settings values ('branding', ?)", (json.dumps(b),))
                return ToolResult(ok=True, message="Branding saved. It shows on every signing page.", data={"branding": b})
            raise ToolError(f"Unknown action '{action}'.")
    finally:
        con.close()


TOOL = ToolSpec(
    id="esign",
    name="Request e-signatures",
    tier="standard",
    adobe_feature="Collect e-signatures and track responses",
    description="Send a PDF for signing with a link, track sent/viewed/signed, keep an audit log. Templates, bulk CSV and branding.",
    params_schema={
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["create", "bulk", "list", "status", "cancel", "open", "sign",
                                                   "template_save", "template_list", "template_delete", "branding_get", "branding_set"], "default": "create"},
            "signer_email": {"type": "string"},
            "signer_name": {"type": "string"},
            "signers": {"type": "array", "items": {"type": "object", "properties": {"email": {"type": "string"}, "name": {"type": "string"}}}},
            "csv": {"type": "string", "description": "Bulk: CSV text with email,name columns"},
            "fields": {"type": "array", "description": "Boxes: {kind: signature|date|name|initials, page, x, y, w, h (fractions, top-left)}", "items": {"type": "object"}},
            "template_id": {"type": "string"},
            "save_template": {"type": "string", "description": "Also save these boxes as a template with this name"},
            "title": {"type": "string"},
            "message": {"type": "string"},
            "public_url": {"type": "string", "description": "branding_set: your own address for signing links, e.g. https://sign.example.com"},
            "request_id": {"type": "string"},
        },
    },
    run=run,
)
