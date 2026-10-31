import io

from pypdf import PdfReader


def test_annotations(upload, run, fetch):
    res = run("annotate", [upload("a-report-3p.pdf")], {"items": [
        {"kind": "text", "page": 1, "x": 0.1, "y": 0.5, "w": 0.5, "h": 0.04, "text": "Approved by finance"},
        {"kind": "whiteout", "page": 1, "x": 0.1, "y": 0.13, "w": 0.4, "h": 0.03, "text": "Page one"},
        {"kind": "highlight", "page": 2, "x": 0.1, "y": 0.18, "w": 0.6, "h": 0.03},
        {"kind": "comment", "page": 2, "x": 0.8, "y": 0.18, "text": "Check this number"},
    ]})
    assert res["ok"], res["message"]
    r = PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"])))
    assert "Approved by finance" in r.pages[0].extract_text()
    subtypes = [a.get_object()["/Subtype"] for a in r.pages[1]["/Annots"]]
    assert subtypes == ["/Highlight", "/Text"]


def test_unknown_kind(upload, run):
    assert not run("annotate", [upload("a-report-3p.pdf")], {"items": [{"kind": "laser", "page": 1, "x": 0, "y": 0}]})["ok"]
