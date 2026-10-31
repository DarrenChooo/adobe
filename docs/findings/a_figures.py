"""Make the figures for a-pdf-internals.md.

    python docs/findings/a_figures.py      -> docs/findings/img/a-*.png
"""
import base64
import io
import os
import re
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("FILLME_STORAGE", tempfile.mkdtemp(prefix="fillme-figs-"))
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from pypdf import PdfReader  # noqa: E402

from app.core import storage  # noqa: E402
from app.core.pdf_utils import render_page_image  # noqa: E402
from app.core.tooling import RunContext  # noqa: E402
from app.tools import esign, fill_sign, protect  # noqa: E402

S = ROOT / "samples"
OUT = Path(__file__).resolve().parent / "img"
OUT.mkdir(exist_ok=True)


def font(size, mono=False):
    names = ["consola.ttf", "DejaVuSansMono.ttf"] if mono else ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            pass
    return ImageFont.load_default()


def ctx(paths):
    return RunContext(work_dir=Path(tempfile.mkdtemp()), file_ids=["x"] * len(paths), filenames=[p.name for p in paths])


def form_fields():
    """The form as people see it, with each field's hidden /T name drawn on top."""
    pdf = S / "a-form-fields.pdf"
    dpi = 110
    img = render_page_image(pdf, 0, dpi).convert("RGB")
    full_h = img.height
    top, keep = int(full_h * 0.07), 0.52  # drop the empty top margin, keep the form part
    img = img.crop((0, top, img.width, int(full_h * keep)))
    W, H = img.size
    canvas = Image.new("RGB", (W + 120, H + 50), "white")
    canvas.paste(img, (0, 50))
    d = ImageDraw.Draw(canvas, "RGBA")
    d.text((16, 12), "Red = the field's internal name (/T), what software sees.  Blue = its tooltip (/TU), what it means.",
           fill=(30, 30, 30), font=font(17))
    fields = fill_sign.list_fields(PdfReader(str(pdf)))
    f_name, f_tip = font(15, mono=True), font(13)
    for f in fields:
        r = f["rect"]
        y0, y1 = r["y"] * full_h - top + 50, (r["y"] + r["h"]) * full_h - top + 50
        box = (r["x"] * W, y0, (r["x"] + r["w"]) * W, y1)
        d.rectangle(box, outline=(214, 52, 44, 255), width=2, fill=(214, 52, 44, 30))
        if f["type"] == "checkbox":
            d.text((box[2] + 6, box[1] + 1), f"/T {f['name']}", fill=(180, 20, 20), font=f_name)
        else:
            d.text((box[0] + 5, box[1] + 3), f"/T {f['name']}", fill=(180, 20, 20), font=f_name)
            d.text((box[2] + 8, box[1] + 4), f"/TU \"{f['tooltip']}\"", fill=(36, 87, 197), font=f_tip)
    canvas.save(OUT / "a-form-fields.png", optimize=True)


def protected_bytes():
    """The same page content, before and after AES-256."""
    src = S / "a-report-3p.pdf"
    out = protect.run([src], {"password": "1234"}, ctx([src])).outputs[0].path
    plain, enc = src.read_bytes(), out.read_bytes()

    def excerpt(data: bytes, needle: bytes) -> list[str]:
        i = data.find(needle)
        chunk = data[max(0, i - 40): i + 420]
        text = chunk.decode("latin-1")
        text = re.sub(r"[^\x20-\x7e\n]", "·", text)
        lines = []
        for raw in text.splitlines():
            while raw:
                lines.append(raw[:58])
                raw = raw[58:]
        return lines[:16]

    left = excerpt(plain, b"Quarterly Report")
    # In the encrypted file, show the page tree and then the first content stream.
    right = excerpt(enc, b"/Type /Pages") + ["", "...page content stream:"] + excerpt(enc[enc.find(b"/Length"):], b"stream")[:8]

    fm, ft = font(14, mono=True), font(18)
    W, H = 1240, 560
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    d.text((20, 14), "Original: title in plain text; page text only zlib-compressed", fill=(30, 30, 30), font=ft)
    d.text((W // 2 + 10, 14), "AES-256 protected: content scrambled, skeleton still readable", fill=(30, 30, 30), font=ft)
    for col, lines in ((20, left), (W // 2 + 10, right)):
        d.rectangle((col - 8, 46, col + W // 2 - 30, H - 16), fill=(246, 247, 249), outline=(220, 223, 228))
        for i, line in enumerate(lines[:30]):
            hl = (b"Quarterly" in line.encode("latin-1")) or ("/Type /Pages" in line) or ("/Count" in line)
            d.text((col, 56 + i * 17), line, fill=(180, 20, 20) if hl else (40, 40, 40), font=fm)
    img.save(OUT / "a-protected-bytes.png", optimize=True)


def signed_page():
    """A signing request taken through the whole loop: signed page + audit page."""
    src = S / "a-report-3p.pdf"
    fid = storage.save_path(src)
    sig = Image.new("RGBA", (360, 110), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sig)
    sd.line([(10, 80), (80, 30), (120, 85), (190, 25), (250, 80), (340, 50)], fill=(26, 43, 109, 255), width=5)
    buf = io.BytesIO()
    sig.save(buf, "PNG")
    sig_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    c = RunContext(work_dir=Path(tempfile.mkdtemp()), file_ids=[fid], filenames=[src.name])
    req = esign.run([storage.get_path(fid)], {
        "action": "create", "signer_email": "alex@example.com", "signer_name": "Alex Lim (made up)",
        "fields": [{"kind": "signature", "page": 3, "x": 0.1, "y": 0.78, "w": 0.3, "h": 0.07},
                   {"kind": "name", "page": 3, "x": 0.1, "y": 0.86, "w": 0.35, "h": 0.025},
                   {"kind": "date", "page": 3, "x": 0.6, "y": 0.8, "w": 0.2, "h": 0.03}],
    }, c).data["requests"][0]
    esign.run([], {"action": "open", "request_id": req["id"]}, c)
    done = esign.run([], {"action": "sign", "request_id": req["id"], "signature": sig_url}, c).data["request"]
    signed = storage.get_path(done["signed_file_id"])
    a, b = render_page_image(signed, 2, 70).convert("RGB"), render_page_image(signed, 3, 70).convert("RGB")
    img = Image.new("RGB", (a.width + b.width + 30, a.height + 20), (230, 232, 236))
    img.paste(a, (10, 10))
    img.paste(b, (a.width + 20, 10))
    img.save(OUT / "a-signed-page.png", optimize=True)


if __name__ == "__main__":
    form_fields()
    protected_bytes()
    signed_page()
    print("Figures written to", OUT)
