"""Measure Person A's numbers (SPEC section 7) and dig into PDF internals.

    python docs/findings/a_measure.py > docs/findings/a-numbers-raw.txt

Runs each tool directly (no HTTP) on the samples, repeats it, and reports the
median time. Also prints the raw structures used in a-pdf-internals.md.
"""
import io
import os
import platform
import statistics
import sys
import tempfile
import time
from pathlib import Path

os.environ.setdefault("FILLME_STORAGE", tempfile.mkdtemp(prefix="fillme-measure-"))
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from pypdf import PdfReader, PdfWriter  # noqa: E402

from app.core.tooling import RunContext  # noqa: E402
from app.tools import compress, create, merge, protect, split  # noqa: E402

S = ROOT / "samples"
REPS = 20


def ctx(paths):
    return RunContext(work_dir=Path(tempfile.mkdtemp()), file_ids=["x"] * len(paths), filenames=[p.name for p in paths])


def timed(fn, *args):
    times = []
    res = None
    for _ in range(REPS):
        t = time.perf_counter()
        res = fn(*args)
        times.append((time.perf_counter() - t) * 1000)
    assert res.ok, res.message
    return statistics.median(times), res


def big_report(pages=50) -> Path:
    """A longer document, made by merging the sample report with itself."""
    w = PdfWriter()
    r = PdfReader(str(S / "a-report-3p.pdf"))
    while len(w.pages) < pages:
        w.append(r)
    p = Path(tempfile.mkdtemp()) / f"report-{pages}p.pdf"
    with open(p, "wb") as f:
        w.write(f)
    return p


def main():
    print(f"# Machine: {platform.platform()}, Python {platform.python_version()}, {REPS} runs each, median\n")
    rep, app = S / "a-report-3p.pdf", S / "a-appendix-2p.pdf"
    big = big_report(51)
    rows = [
        ("merge 3p + 2p", merge.run, [rep, app], {}),
        ("merge 51p + 2p", merge.run, [big, app], {}),
        ("split 3p into 3 files", split.run, [rep], {"mode": "every", "every": 1}),
        ("split 51p into 51 files", split.run, [big], {"mode": "every", "every": 1}),
        ("protect 3p (AES-256)", protect.run, [rep], {"password": "1234"}),
        ("protect 51p (AES-256)", protect.run, [big], {"password": "1234"}),
    ]
    print("| Operation | Median time (ms) |\n|---|---|")
    for label, fn, ins, params in rows:
        ms, _ = timed(lambda: fn(ins, params, ctx(ins)))
        print(f"| {label} | {ms:.1f} |")

    # Compression: an image-heavy PDF made from the sample photo at full resolution.
    photo = S / "a-photo.jpg"
    made = create.run([photo] * 5, {"fit": "image"}, ctx([photo] * 5))
    src = made.outputs[0].path
    print("\n| Compression level | Before (KB) | After (KB) | Saved |\n|---|---|---|---|")
    for level in ("low", "medium", "high"):
        r = compress.run([src], {"level": level}, ctx([src]))
        d = r.data
        print(f"| {level} (5 photo pages) | {d['bytes_before'] / 1024:.0f} | {d['bytes_after'] / 1024:.0f} | {d['percent_saved']}% |")
    r = compress.run([rep], {}, ctx([rep]))
    print(f"| medium (3p text-only report) | {r.data['bytes_before'] / 1024:.1f} | {r.data['bytes_after'] / 1024:.1f} | {r.data['percent_saved']}% |")

    # Internals: page tree and form fields.
    print("\n# Page tree of a-report-3p.pdf")
    rd = PdfReader(str(rep))
    root = rd.trailer["/Root"]
    pages = root["/Pages"]
    print("Catalog keys:", list(root.keys()))
    print("Pages node:", {k: (v if k != "/Kids" else f"[{len(v)} refs]") for k, v in pages.items()})
    print("Kids:", [str(k.idnum) + " 0 R" for k in pages["/Kids"]])
    print("Page 1 keys:", list(rd.pages[0].keys()))

    print("\n# AcroForm fields of a-form-fields.pdf")
    fr = PdfReader(str(S / "a-form-fields.pdf"))
    acro = fr.trailer["/Root"]["/AcroForm"]
    print("AcroForm keys:", list(acro.keys()), "| field count:", len(acro["/Fields"]))
    for f in acro["/Fields"]:
        f = f.get_object()
        print(f"  /T {str(f.get('/T')):<12} /FT {str(f.get('/FT')):<5} /TU {f.get('/TU')!s:<28} /Rect {[round(float(v)) for v in f['/Rect']]}")

    print("\n# What encryption covers")
    out = protect.run([rep], {"password": "1234"}, ctx([rep]))
    raw = out.outputs[0].path.read_bytes()
    print("Plain text 'Quarterly Report' visible in protected bytes:", b"Quarterly Report" in raw)
    print("Plain text 'Quarterly Report' visible in original bytes: ", b"Quarterly Report" in rep.read_bytes())
    pr = PdfReader(io.BytesIO(raw))
    enc = pr.trailer["/Encrypt"]
    print("/Encrypt dict:", {k: (v if k in ("/Filter", "/V", "/R", "/Length", "/P") else "<bytes>") for k, v in enc.items()})
    print("Readable without password?", not pr.is_encrypted or bool(pr.decrypt("")))
    # Only strings and streams are encrypted; the object structure stays plain text.
    print("'/Type /Pages' visible in protected bytes:", b"/Type /Pages" in raw)
    print("'/Count 3' visible in protected bytes:", b"/Count 3" in raw)
    print("'/MediaBox' visible in protected bytes:", b"/MediaBox" in raw)
    # Permissions: open with the user password, then just ignore the flags.
    pr = PdfReader(io.BytesIO(raw))
    pr.decrypt("1234")
    print("Text extracted despite allow_copy=False:", pr.pages[0].extract_text()[:40].replace("\n", " "))
    print("Signed /P permission value:", int(enc["/P"]), "=", bin(int(enc["/P"]) & 0xFFFFFFFF))


if __name__ == "__main__":
    main()
