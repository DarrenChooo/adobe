"""fill_sign: list a PDF's form fields, fill them by hand, and place a signature.

action=list -> data.fields: [{name, tooltip, type, value, options, page, rect}]
               data.anchors: {signature, date} -> where a "Signature:" / "Date:" line is, or null
action=fill -> values {field name: value}, stamps [{page, x, y, w, h, kind, image|text}]
"""
import re
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject

from app.core.pdf_utils import open_pdf, page_size, text_with_boxes
from app.core.stamp import apply_stamps
from app.core.tooling import Output, RunContext, ToolError, ToolResult, ToolSpec

TYPES = {"/Tx": "text", "/Btn": "checkbox", "/Ch": "choice", "/Sig": "signature"}


def _on_state(annot) -> str:
    """The 'checked' appearance name of a checkbox/radio widget (e.g. /Yes, /On)."""
    try:
        for k in annot["/AP"]["/N"].keys():
            if k != "/Off":
                return k
    except (KeyError, TypeError):
        pass
    return "/Yes"


def list_fields(reader: PdfReader) -> list[dict]:
    fields = []
    seen = set()
    for pno, page in enumerate(reader.pages, start=1):
        pw, ph = float(page.mediabox.width), float(page.mediabox.height)
        left, bottom = float(page.mediabox.left), float(page.mediabox.bottom)
        for a in page.get("/Annots") or []:
            a = a.get_object()
            if a.get("/Subtype") != "/Widget":
                continue
            node = a if "/T" in a else a.get("/Parent", a).get_object()
            name_parts = []
            n = node
            while n is not None:
                if "/T" in n:
                    name_parts.append(str(n["/T"]))
                n = n.get("/Parent").get_object() if "/Parent" in n else None
            name = ".".join(reversed(name_parts))
            ft = node.get("/FT") or a.get("/FT")
            ftype = TYPES.get(ft, str(ft))
            if ftype == "checkbox" and int(node.get("/Ff", 0)) & (1 << 15):
                ftype = "radio"
            if ftype == "checkbox" and int(node.get("/Ff", 0)) & (1 << 16):
                ftype = "button"
            if name in seen and ftype != "radio":
                continue
            seen.add(name)
            r = [float(v) for v in a.get("/Rect", [0, 0, 0, 0])]
            x0, y0, x1, y1 = min(r[0], r[2]), min(r[1], r[3]), max(r[0], r[2]), max(r[1], r[3])
            value = node.get("/V")
            opts = node.get("/Opt")
            fields.append({
                "name": name,
                "tooltip": str(node["/TU"]) if "/TU" in node else None,
                "type": ftype,
                "value": str(value) if value is not None else None,
                "options": [str(o[1] if isinstance(o, list) else o) for o in opts] if opts else None,
                "on_value": _on_state(a)[1:] if ftype in ("checkbox", "radio") else None,
                "page": pno,
                # top-left fractional box, same convention as stamps/PdfPreview
                "rect": {"x": (x0 - left) / pw, "y": (bottom + ph - y1) / ph, "w": (x1 - x0) / pw, "h": (y1 - y0) / ph},
            })
    return fields


def fill(reader: PdfReader, values: dict, flatten: bool) -> PdfWriter:
    writer = PdfWriter(clone_from=reader)
    fields = {f["name"]: f for f in list_fields(reader)}
    unknown = [k for k in values if k not in fields]
    if unknown:
        raise ToolError(f"No such field(s): {', '.join(unknown)}")
    clean = {}
    for k, v in values.items():
        f = fields[k]
        if f["type"] in ("checkbox", "radio"):
            on = f["on_value"] or "Yes"
            truthy = v is True or str(v).lower() in ("true", "yes", "on", "1", on.lower())
            clean[k] = NameObject(f"/{on}") if truthy else NameObject("/Off")
        else:
            clean[k] = "" if v is None else str(v)
    for page in writer.pages:
        writer.update_page_form_field_values(page, clean, auto_regenerate=False, flatten=flatten)
    writer.set_need_appearances_writer(True)
    if flatten:
        # Values are now drawn into the page content; drop the live widgets.
        writer.remove_annotations(subtypes="/Widget")
        if "/AcroForm" in writer._root_object:
            del writer._root_object["/AcroForm"]
    return writer


# Box size (fractions of the page) for each kind of stamp placed on a label's line.
_ANCHOR_SIZE = {"signature": (0.3, 0.07), "date": (0.16, 0.025)}
_LABEL = {"signature": re.compile(r"^signature:?$", re.I), "date": re.compile(r"^date:?$", re.I)}


def find_anchors(path: Path, n_pages: int) -> dict:
    """Where a signature and a date should go: just right of the last "Signature"
    and "Date" label in the document, sitting on that label's line. "Date of birth"
    and similar don't count. Boxes use the same top-left fractions as stamps."""
    found: dict = {"signature": None, "date": None}
    caption_rows: set = set()  # (page, row top) of labels printed UNDER their line, like the W-4's
    try:
        for p in range(n_pages):
            words = text_with_boxes(path, p)
            pw, ph = page_size(path, p)
            same_row = lambda a, b: abs(a["top"] - b["top"]) < 3
            for i, w in enumerate(words):
                nxt = words[i + 1] if i + 1 < len(words) else None
                for kind, rx in _LABEL.items():
                    if not rx.match(w["text"]) or (nxt and nxt["text"].lower() in ("of", "signed", "issued", "received")):
                        continue
                    bw, bh = _ANCHOR_SIZE[kind]
                    # A caption ("Employee's signature (This form...)") has more words right after it on
                    # its row, or shares a row with one: then the line to sign on is just above it.
                    row = (p, round(w["top"]))
                    caption = (nxt is not None and same_row(nxt, w) and nxt["x0"] - w["x1"] < 20) or \
                              any(r[0] == p and abs(r[1] - w["top"]) < 3 for r in caption_rows)
                    if caption:
                        caption_rows.add(row)
                        start = i  # start of the caption phrase, e.g. "Employee's"
                        while start > 0 and same_row(words[start - 1], w) and w["x0"] - words[start - 1]["x1"] < 60:
                            start -= 1
                        x = min(words[start]["x0"] / pw, 1 - bw)
                        y = max(0.0, (w["top"] - 3) / ph - bh)
                    else:
                        x = min((w["x1"] + 8) / pw, 1 - bw)
                        y = max(0.0, (w["bottom"] + 2) / ph - bh)
                    found[kind] = {"page": p + 1, "x": x, "y": y, "w": bw, "h": bh}
    except Exception:
        pass  # anchors are a convenience; never fail the field list over them
    return found


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    reader = open_pdf(inputs[0], params.get("password"))
    action = params.get("action", "fill")
    if action == "list":
        fields = list_fields(reader)
        msg = f"Found {len(fields)} form field(s)." if fields else "No fillable fields. You can still place a signature or text."
        return ToolResult(ok=True, message=msg, data={"fields": fields, "pages": len(reader.pages),
                                                      "anchors": find_anchors(inputs[0], len(reader.pages))})

    values = params.get("values") or {}
    stamps = params.get("stamps") or []
    if not values and not stamps:
        raise ToolError("Fill at least one field or place a signature.")
    stem = Path(ctx.filenames[0]).stem
    filled = ctx.work_dir / "filled.pdf"
    writer = fill(reader, values, bool(params.get("flatten"))) if values else PdfWriter(clone_from=reader)
    with open(filled, "wb") as f:
        writer.write(f)
    name = f"{stem}_signed.pdf" if stamps else f"{stem}_filled.pdf"
    out = ctx.work_dir / name
    if stamps:
        apply_stamps(filled, out, stamps)
    else:
        filled.rename(out)
    return ToolResult(
        ok=True,
        message=f"Filled {len(values)} field(s)" + (f" and placed {len(stamps)} item(s)." if stamps else "."),
        outputs=[Output(out, name, "application/pdf")],
        data={"filled": list(values), "stamps": len(stamps)},
    )


TOOL = ToolSpec(
    id="fill_sign",
    name="Fill & Sign",
    tier="standard",
    adobe_feature="Fill, sign",
    description="Fill a PDF's form fields by hand, and draw or type a signature and place it on a page.",
    params_schema={
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["list", "fill"], "default": "fill"},
            "values": {"type": "object", "description": "Field name -> value. Checkboxes take true/false."},
            "stamps": {
                "type": "array",
                "description": "Things to draw: {page (1-based), x, y, w, h (fractions of the page, top-left origin), kind: image|text, image (PNG data URL) or text}",
                "items": {"type": "object"},
            },
            "flatten": {"type": "boolean", "default": False, "description": "Make filled fields permanent (not editable)"},
        },
    },
    run=run,
    min_files=1,
    max_files=1,
)
