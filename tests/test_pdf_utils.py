"""The shared helpers B and C rely on."""
import pytest

from app.core import pdf_utils as u
from conftest import SAMPLES

REPORT = SAMPLES / "a-report-3p.pdf"


def test_page_count_and_size():
    assert u.page_count(REPORT) == 3
    assert u.page_count(SAMPLES / "a-photo.jpg") == 0
    w, h = u.page_size(REPORT)
    assert round(w) == 595 and round(h) == 842  # A4


def test_render_png():
    png = u.render_page_png(REPORT, 0, dpi=36)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"


def test_text_with_boxes_top_left_origin():
    words = u.text_with_boxes(REPORT, 0)
    texts = [w["text"] for w in words]
    assert texts[:3] == ["Quarterly", "Report", "(sample)"]
    title = words[0]
    # Title is drawn 90pt below the top edge (baseline), 22pt bold.
    assert 60 < title["top"] < 90 < title["bottom"] < 95
    assert title["x0"] == pytest.approx(72, abs=1)
    line = next(w for w in words if w["text"] == "Line")
    assert line["top"] > title["bottom"]


def test_page_text_and_ranges():
    assert "Page 2 of 3" in u.page_text(REPORT, 1)
    assert u.parse_ranges("1-2,3", 3) == [[0, 1], [2]]
    assert u.parse_ranges("2-", 3) == [[1, 2]]
    with pytest.raises(ValueError):
        u.parse_ranges("0-1", 3)
