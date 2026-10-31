import io

from pypdf import PdfReader


def test_compress_image_pdf(upload, run, fetch):
    # Build an image-heavy PDF first (images at full resolution), then compress it.
    made = run("create", [upload("a-photo.jpg")], {"fit": "image"})
    src = made["outputs"][0]["file_id"]
    res = run("compress", [src], {"level": "high"})
    assert res["ok"], res["message"]
    d = res["data"]
    assert d["bytes_after"] < d["bytes_before"]
    assert len(PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"]))).pages) == 1


def test_compress_never_grows(upload, run):
    d = run("compress", [upload("a-appendix-2p.pdf")])["data"]
    assert d["bytes_after"] <= d["bytes_before"]
