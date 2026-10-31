"""Make Person B's sample PDFs. Every person and number here is made up.

  .venv/bin/python tests/b_samples.py            # writes into samples/
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

FONT, SIZE = "Helvetica", 11
W, H = A4

LETTER_P1 = [
    "Fill Me sample: Application for Event Pass (all details are made up)",
    "",
    "Applicant name: Tan Wei Ming",
    "NRIC: S1234567D",
    "Mobile: +65 9123 4567",
    "Email: weiming.tan@example.com",
    "Address: Blk 123 Example Street 45, #06-78, Singapore 123456",
    "",
    "Emergency contact: Lim Mei Ling (sister), tel 8765 4321, NRIC T0123456Z",
    "",
    "Invoice No. 12345678 dated 2026-10-31. Order ref S12345.",
]
LETTER_P2 = [
    "Supporting details",
    "",
    "Co-applicant FIN: F9876543N",
    "Co-applicant mobile: 91112222",
    "Office line: 6123 4567",
    "Co-applicant email: mei.ling@example.org",
    "Guarantor NRIC: G1122334K",
    "Postal code 123456 is not a phone number.",
    "Co-applicant address: Block 45A Sample Avenue 3, #12-345, S(560045)",
    "Guarantor address: 88 Example Crescent, Singapore 588888",
    "Mailing unit #03-21 at the same block.",
    "Meeting at 2 pm in Room 5, Level 3 of the main building.",
]
PLANTED = {
    "nric": ["S1234567D", "T0123456Z", "F9876543N", "G1122334K"],
    "phone": ["+65 9123 4567", "8765 4321", "91112222", "6123 4567"],
    "email": ["weiming.tan@example.com", "mei.ling@example.org"],
    "address": [
        "Blk 123 Example Street 45, #06-78, Singapore 123456",
        "Block 45A Sample Avenue 3, #12-345, S(560045)",
        "88 Example Crescent, Singapore 588888",
        "#03-21",
    ],
    "decoys": ["12345678", "123456", "S12345", "2026-10-31", "Room 5", "Level 3", "2 pm"],
}

CONTRACT_V1 = [
    "SERVICE AGREEMENT (sample, made up)",
    "1. Provider: Example Services Pte Ltd.",
    "2. Client: Sample Trading Co.",
    "3. Start date: 1 November 2026.",
    "4. Monthly fee: SGD 1,200.",
    "5. Payment due within 30 days of invoice.",
    "6. Either party may end this agreement with 14 days notice.",
    "7. The provider keeps client data confidential.",
    "8. Support hours: Monday to Friday, 9am to 6pm.",
    "9. Governing law: Singapore.",
    "10. This agreement renews every 12 months.",
]
CONTRACT_V2 = [
    "SERVICE AGREEMENT (sample, made up)",
    "1. Provider: Example Services Pte Ltd.",
    "2. Client: Sample Holdings Co.",                                   # edit 1: changed
    "3. Start date: 1 November 2026.",
    "4. Monthly fee: SGD 1,500.",                                       # edit 2: changed
    "5. Payment due within 30 days of invoice.",
    "6. Either party may end this agreement with 14 days notice.",
    # edit 3: clause 7 removed
    "8. Support hours: Monday to Friday, 9am to 6pm.",
    "8a. Weekend support is charged at SGD 200 per hour.",              # edit 4: added
    "9. Governing law: Singapore.",
    "10. This agreement renews every 24 months.",                       # edit 5: changed
]
PLANTED_EDITS = 5


def _page(c: canvas.Canvas, lines: list[str], top: float = H - 72) -> list[tuple[str, float, float]]:
    """Draw lines; return (text, x, baseline_y) for each."""
    c.setFont(FONT, SIZE)
    placed, y = [], top
    for ln in lines:
        c.drawString(72, y, ln)
        placed.append((ln, 72, y))
        y -= 20
    return placed


def _cover(c: canvas.Canvas, placed, needle: str) -> None:
    """Naive 'redaction': draw a black box over the words. The text stays in the file."""
    for ln, x, y in placed:
        if needle in ln:
            x0 = x + stringWidth(ln[: ln.index(needle)], FONT, SIZE)
            c.setFillColorRGB(0, 0, 0)
            c.rect(x0 - 1, y - 3, stringWidth(needle, FONT, SIZE) + 2, SIZE + 4, fill=1, stroke=0)


def make(out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    paths = {}

    p = out / "b_pii_letter.pdf"
    c = canvas.Canvas(str(p), pagesize=A4, invariant=1)
    _page(c, LETTER_P1); c.showPage()
    _page(c, LETTER_P2); c.showPage(); c.save()
    paths["letter"] = p

    p = out / "b_naive_redaction.pdf"
    c = canvas.Canvas(str(p), pagesize=A4, invariant=1)
    placed = _page(c, LETTER_P1)
    for needle in ("S1234567D", "+65 9123 4567", "T0123456Z"):
        _cover(c, placed, needle)
    c.showPage(); c.save()
    paths["naive"] = p

    for name, lines in (("b_contract_v1.pdf", CONTRACT_V1), ("b_contract_v2.pdf", CONTRACT_V2)):
        p = out / name
        c = canvas.Canvas(str(p), pagesize=A4, invariant=1)
        _page(c, lines); c.showPage(); c.save()
        paths[name[:-4]] = p

    p = out / "b_table.pdf"
    c = canvas.Canvas(str(p), pagesize=A4, invariant=1)
    c.setFont(FONT, SIZE)
    rows = [["Item", "Qty", "Unit price", "Total"], ["Pens", "10", "1.50", "15.00"], ["Paper", "5", "6.00", "30.00"],
            ["Folders", "8", "2.25", "18.00"], ["Grand total", "", "", "63.00"]]
    x0, y0, cw, rh = 72, H - 100, 110, 24
    for r, row in enumerate(rows):
        for col, val in enumerate(row):
            c.drawString(x0 + col * cw + 6, y0 - r * rh - 16, val)
    for r in range(len(rows) + 1):
        c.line(x0, y0 - r * rh, x0 + 4 * cw, y0 - r * rh)
    for col in range(5):
        c.line(x0 + col * cw, y0, x0 + col * cw, y0 - len(rows) * rh)
    c.showPage(); c.save()
    paths["table"] = p

    # A fillable form (real AcroForm fields) and the same form flat (no fields).
    for name, fillable in (("b_form_fillable.pdf", True), ("b_form_flat.pdf", False)):
        p = out / name
        c = canvas.Canvas(str(p), pagesize=A4, invariant=1)
        c.setFont(FONT, SIZE)
        c.drawString(72, H - 72, "Event Pass Registration (sample, made up)")
        rows = [("Full name", "full_name"), ("NRIC", "nric"), ("Email", "email")]
        for i, (label, key) in enumerate(rows):
            y = H - 120 - i * 36
            c.drawString(72, y, f"{label}:")
            if fillable:
                c.acroForm.textfield(name=key, tooltip=label, x=180, y=y - 5, width=260, height=18,
                                     borderWidth=1, forceBorder=True, fontSize=10)
            else:
                c.line(180, y - 4, 440, y - 4)
        y = H - 120 - 3 * 36
        c.drawString(72, y, "Pass type:")
        if fillable:
            c.acroForm.choice(name="pass_type", tooltip="Pass type", value="Day", options=["Day", "Weekend", "VIP"],
                              x=180, y=y - 5, width=140, height=18, fontSize=10)
        c.drawString(72, y - 36, "I agree to the event terms")
        if fillable:
            c.acroForm.checkbox(name="agree", tooltip="I agree to the event terms", x=260, y=y - 41, size=14)
        c.showPage(); c.save()
        paths[name[:-4]] = p

    # Scanned copy of letter page 1: an image-only PDF with no text layer.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.pro.pdfio import render_page
    img = render_page(paths["letter"], 0, 150)
    p = out / "b_scan.pdf"
    img.save(p, format="PDF", resolution=150)
    paths["scan"] = p

    truth = {"planted": PLANTED, "planted_edits": PLANTED_EDITS, "scan_text": [l for l in LETTER_P1 if l]}
    (out / "b_planted.json").write_text(json.dumps(truth, indent=2))
    return {k: str(v) for k, v in paths.items()}


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    print(json.dumps(make(root / "samples"), indent=2))
