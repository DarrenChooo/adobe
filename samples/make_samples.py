"""Regenerate Person A's sample files. All data is made up.

    python samples/make_samples.py
"""
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

HERE = Path(__file__).resolve().parent
W, H = A4


def text_pdf(path: Path, title: str, pages: int):
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle(title)
    for i in range(1, pages + 1):
        c.setFont("Helvetica-Bold", 22)
        c.drawString(72, H - 90, f"{title}")
        c.setFont("Helvetica", 13)
        c.drawString(72, H - 120, f"Page {i} of {pages}")
        y = H - 160
        for line in range(12):
            c.drawString(72, y, f"Line {line + 1}: sample text on page {i} for testing merge, split and organise.")
            y -= 20
        c.setFont("Helvetica-Bold", 120)
        c.setFillColor(HexColor("#dddddd"))
        c.drawCentredString(W / 2, 200, str(i))
        c.setFillColor(HexColor("#000000"))
        c.showPage()
    c.save()


def form_pdf(path: Path):
    """A small made-up application form with real AcroForm fields, including
    unhelpful internal names (txtLName_1) and tooltips, like real forms."""
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Sample Membership Application")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, H - 80, "Sample Club Membership Application")
    c.setFont("Helvetica", 10)
    c.drawString(72, H - 98, "Made-up form for testing Fill Me. Not a real organisation.")
    form = c.acroForm
    rows = [
        ("Surname", "txtLName_1", "Surname / family name"),
        ("Given name", "txtFName_1", "Given name(s)"),
        ("NRIC / FIN", "txtID_1", "NRIC or FIN number"),
        ("Date of birth", "dob", "Date of birth (DD/MM/YYYY)"),
        ("Email", "txtEmail", "Email address"),
        ("Mobile", "txtTel_2", "Mobile phone number"),
        ("Address", "addr1", "Residential address"),
    ]
    y = H - 140
    for label, name, tip in rows:
        c.setFont("Helvetica", 11)
        c.drawString(72, y + 4, label)
        form.textfield(name=name, tooltip=tip, x=200, y=y - 2, width=300, height=20, borderWidth=1, fontSize=11)
        y -= 36
    c.drawString(72, y + 4, "Membership type")
    form.choice(name="cboType", tooltip="Membership type", value="Standard", options=["Standard", "Student", "Family"],
                x=200, y=y - 2, width=150, height=20, fontSize=11)
    y -= 36
    c.drawString(72, y + 4, "I agree to the club rules")
    form.checkbox(name="chkAgree", tooltip="Agree to the rules", x=200, y=y - 2, size=16)
    y -= 60
    c.drawString(72, y, "Signature:")
    c.line(150, y - 2, 400, y - 2)
    c.drawString(420, y, "Date:")
    c.line(455, y - 2, 540, y - 2)
    c.showPage()
    c.save()


def sample_image(path: Path):
    img = Image.new("RGB", (1200, 800), "#f2efe6")
    d = ImageDraw.Draw(img)
    for i in range(0, 1200, 60):
        d.line([(i, 0), (i + 400, 800)], fill="#d9c9a3", width=8)
    d.rectangle([100, 100, 1100, 700], outline="#8a5a2b", width=10)
    d.text((140, 140), "Sample photo for images-to-PDF and compress", fill="#3b2a16")
    img.save(path, quality=95)


if __name__ == "__main__":
    text_pdf(HERE / "a-report-3p.pdf", "Quarterly Report (sample)", 3)
    text_pdf(HERE / "a-appendix-2p.pdf", "Appendix (sample)", 2)
    form_pdf(HERE / "a-form-fields.pdf")
    sample_image(HERE / "a-photo.jpg")
    (HERE / "a-notes.md").write_text(
        "# Meeting notes (sample)\n\nMade-up notes for testing **text to PDF**.\n\n"
        "## Decisions\n\n- Stack: FastAPI + React\n- Licence: MIT\n\n## Next steps\n\n1. Build the scaffold\n2. Ship the tools\n",
        encoding="utf-8",
    )
    print("Samples written to", HERE)
