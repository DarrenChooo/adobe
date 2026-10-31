import io

from pypdf import PdfReader


def read(fetch, res):
    return PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"])))


def test_reorder_rotate_delete(upload, run, fetch):
    res = run("organize", [upload("a-report-3p.pdf")], {"pages": [3, {"page": 1, "rotate": 90}]})
    assert res["ok"], res["message"]
    r = read(fetch, res)
    assert len(r.pages) == 2
    assert "Page 3 of 3" in r.pages[0].extract_text()
    assert r.pages[1].rotation == 90


def test_simple_options(upload, run, fetch):
    res = run("organize", [upload("a-report-3p.pdf")], {"delete": "2", "rotate": 180, "rotate_pages": "3"})
    r = read(fetch, res)
    assert len(r.pages) == 2 and r.pages[0].rotation == 0 and r.pages[1].rotation == 180


def test_cannot_delete_everything(upload, run):
    assert not run("organize", [upload("a-report-3p.pdf")], {"delete": "1-3"})["ok"]
