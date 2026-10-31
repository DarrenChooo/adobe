import io

from pypdf import PdfReader


def test_merge_page_count_is_sum(upload, run, fetch):
    a, b = upload("a-report-3p.pdf"), upload("a-appendix-2p.pdf")
    res = run("merge", [a, b])
    assert res["ok"], res["message"]
    r = PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"])))
    assert len(r.pages) == 5
    assert "Page 1 of 2" in r.pages[3].extract_text()  # appendix comes after the report
    assert [o.title for o in r.outline] == ["a-report-3p", "a-appendix-2p"]


def test_merge_needs_two(upload, run):
    assert not run("merge", [upload("a-report-3p.pdf")])["ok"]
