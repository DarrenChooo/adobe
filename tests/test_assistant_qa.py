from reportlab.pdfgen import canvas

from app.tools import assistant_qa

PAGES = ["The refund deadline is 30 June.", "Fees are waived for students."]


def make_pdf(path):
    c = canvas.Canvas(str(path))
    for text in PAGES:
        c.drawString(50, 760, text)
        c.showPage()
    c.save()
    return path


def fake_model(monkeypatch, answer):
    seen = []

    def complete(system, user, json_schema=None, model=None):
        seen.append(user)
        return answer

    monkeypatch.setattr(assistant_qa.llm, "complete", complete)
    return seen


def test_good_citation_passes(tmp_path, monkeypatch):
    fake_model(monkeypatch, {"found": True, "answer": "30 June [p.1]",
                             "citations": [{"page": 1, "quote": "refund deadline is 30 June"}]})
    reply = assistant_qa.ask(make_pdf(tmp_path / "a.pdf"), "When is the refund deadline?")
    assert reply["all_verified"] is True


def test_quote_not_on_that_page_fails(tmp_path, monkeypatch):
    fake_model(monkeypatch, {"found": True, "answer": "30 June [p.2]",
                             "citations": [{"page": 2, "quote": "refund deadline is 30 June"}]})
    reply = assistant_qa.ask(make_pdf(tmp_path / "a.pdf"), "When?")
    assert reply["all_verified"] is False
    assert reply["citations"][0]["page_exists"] is True
    assert reply["citations"][0]["quote_found"] is False


def test_page_that_does_not_exist_fails(tmp_path, monkeypatch):
    fake_model(monkeypatch, {"found": True, "answer": "Maybe [p.9]",
                             "citations": [{"page": 9, "quote": "anything"}]})
    reply = assistant_qa.ask(make_pdf(tmp_path / "a.pdf"), "When?")
    assert reply["all_verified"] is False
    assert reply["citations"][0]["page_exists"] is False


def test_page_cited_in_answer_without_a_quote_fails(tmp_path, monkeypatch):
    fake_model(monkeypatch, {"found": True, "answer": "30 June [p.1], waived [p.2]",
                             "citations": [{"page": 1, "quote": "refund deadline is 30 June"}]})
    reply = assistant_qa.ask(make_pdf(tmp_path / "a.pdf"), "When?")
    assert reply["all_verified"] is False


def test_refusal_uses_fixed_wording(tmp_path, monkeypatch):
    fake_model(monkeypatch, {"found": False, "answer": "No idea", "citations": []})
    reply = assistant_qa.ask(make_pdf(tmp_path / "a.pdf"), "Who is the CEO?")
    assert reply["answer"] == assistant_qa.NOT_IN_DOCUMENT


def test_scan_with_no_text_asks_for_ocr_without_calling_the_model(tmp_path, monkeypatch):
    seen = fake_model(monkeypatch, {})
    path = tmp_path / "blank.pdf"
    c = canvas.Canvas(str(path))
    c.showPage()
    c.save()
    reply = assistant_qa.ask(path, "Anything?")
    assert reply["needs_ocr"] is True
    assert seen == []


def test_long_documents_keep_the_most_relevant_pages():
    pages = ["filler " * 50, "the refund deadline is here " * 5, "filler " * 50]
    assert assistant_qa.select_pages(pages, "refund deadline", limit=200) == [1]


def test_two_column_pages_read_column_by_column():
    pages = assistant_qa.extract_pages("samples/forms/irs_w4.pdf")
    assert "you had no federal income tax liability in 2025 and" in " ".join(pages[1].split())
