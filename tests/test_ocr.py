import re

from b_fixtures import samples  # noqa: F401

from app.pro import ocr
from app.pro.pdfio import all_text


def _words(s: str) -> list[str]:
    return re.findall(r"\S+", s)


def word_accuracy(expected: list[str], got: str) -> float:
    """Share of expected words that appear in the OCR output (order ignored)."""
    pool = _words(got)
    hits = 0
    for w in _words(" ".join(expected)):
        if w in pool:
            pool.remove(w)
            hits += 1
    return hits / max(1, len(_words(" ".join(expected))))


def test_scan_becomes_searchable(samples):
    assert all_text(samples["scan"])[0].strip() == ""  # really a scan: no text to start with
    res = ocr.run([samples["scan"]], {"dpi": 300}, samples["out"])
    assert res["ok"] and res["data"]["pages_ocr"] == [1]
    text = all_text(res["outputs"][0]["path"])[0]
    assert "Tan Wei Ming" in text
    acc = word_accuracy(samples["truth"]["scan_text"], text)
    print(f"OCR word accuracy on the scan sample: {acc:.1%}")
    assert acc >= 0.9
    # Known failure case, kept visible on purpose: Tesseract tends to read the NRIC's leading S as "$".


def test_pages_with_text_are_left_alone(samples):
    res = ocr.run([samples["letter"]], {}, samples["out"])
    assert res["data"]["pages_skipped"] == [1, 2] and res["data"]["pages_ocr"] == []
