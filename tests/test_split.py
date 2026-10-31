import io

from pypdf import PdfReader


def pages(fetch, out):
    return len(PdfReader(io.BytesIO(fetch(out["file_id"]))).pages)


def test_split_ranges(upload, run, fetch):
    res = run("split", [upload("a-report-3p.pdf")], {"mode": "ranges", "ranges": "1-2,3"})
    assert res["ok"], res["message"]
    assert [pages(fetch, o) for o in res["outputs"]] == [2, 1]
    assert res["outputs"][0]["filename"] == "a-report-3p_p1-2.pdf"


def test_split_every(upload, run, fetch):
    res = run("split", [upload("a-report-3p.pdf")], {"mode": "every", "every": 1})
    assert len(res["outputs"]) == 3


def test_split_bad_range(upload, run):
    res = run("split", [upload("a-report-3p.pdf")], {"mode": "ranges", "ranges": "2-9"})
    assert not res["ok"] and "outside" in res["message"]
