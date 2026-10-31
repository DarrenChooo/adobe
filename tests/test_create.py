import io

from pypdf import PdfReader


def test_images_to_pdf(upload, run, fetch):
    res = run("create", [upload("a-photo.jpg"), upload("a-photo.jpg")])
    assert res["ok"], res["message"]
    r = PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"])))
    assert len(r.pages) == 2
    assert r.pages[0].mediabox.width > r.pages[0].mediabox.height  # landscape photo -> landscape page


def test_markdown_file_to_pdf(upload, run, fetch):
    res = run("create", [upload("a-notes.md")])
    text = PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"]))).pages[0].extract_text()
    assert "Meeting notes" in text and "Build the scaffold" in text and "**" not in text


def test_typed_text(run, fetch):
    res = run("create", [], {"text": "# Hello\n\nSome *text*.", "filename": "hello.pdf"})
    assert res["outputs"][0]["filename"] == "hello.pdf"


def test_rejects_other_files(upload, run):
    assert not run("create", [upload("a-report-3p.pdf")])["ok"]
