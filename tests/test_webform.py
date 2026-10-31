import csv

from tests.b_fixtures import samples  # noqa: F401

from pypdf import PdfReader

from app.pro import webform


def _params(samples, **kw):
    return {"storage": str(samples["out"] / "storage"), **kw}


def test_inspect_reads_every_field(samples):
    res = webform.run([samples["b_form_fillable"]], {"mode": "inspect"}, samples["out"])
    by_name = {f["name"]: f for f in res["data"]["fields"]}
    assert set(by_name) == {"full_name", "nric", "email", "pass_type", "agree"}
    assert by_name["nric"]["label"] == "NRIC"
    assert by_name["pass_type"]["type"] == "choice" and by_name["pass_type"]["options"] == ["Day", "Weekend", "VIP"]
    assert by_name["agree"]["type"] == "checkbox"


def test_flat_pdf_cannot_become_a_form_directly(samples):
    res = webform.run([samples["b_form_flat"]], _params(samples, mode="create"), samples["out"])
    assert not res["ok"] and "add_fields" in res["message"]


def test_create_submit_twice_and_export(samples):
    made = webform.run([samples["b_form_fillable"]], _params(samples, mode="create", title="EventPass"), samples["out"])
    assert made["ok"] and made["data"]["share_path"].startswith("/f/")
    fid = made["data"]["form_id"]

    schema = webform.run([], _params(samples, mode="schema", form_id=fid), samples["out"])
    assert len(schema["data"]["fields"]) == 5

    people = [
        {"full_name": "Tan Wei Ming", "nric": "S1234567D", "email": "wm@example.com", "pass_type": "VIP", "agree": True},
        {"full_name": "Lim Mei Ling", "nric": "T0123456Z", "email": "ml@example.org", "pass_type": "Day", "agree": False},
    ]
    for i, answers in enumerate(people, start=1):
        sub = webform.run([], _params(samples, mode="submit", form_id=fid, answers=answers), samples["out"])
        assert sub["ok"] and sub["data"]["response_id"] == i
        got = {k: v.get("/V") for k, v in PdfReader(sub["outputs"][0]["path"]).get_fields().items()}
        assert got["full_name"] == answers["full_name"] and got["pass_type"] == answers["pass_type"]
        assert str(got["agree"]) == ("/Yes" if answers["agree"] else "/Off")

    exp = webform.run([], _params(samples, mode="responses", form_id=fid), samples["out"])
    rows = list(csv.reader(open(exp["outputs"][0]["path"])))
    assert exp["data"]["count"] == 2 and rows[1][2] == "Tan Wei Ming" and rows[2][3] == "T0123456Z"


def test_unknown_form_link(samples):
    res = webform.run([], _params(samples, mode="schema", form_id="nope1234"), samples["out"])
    assert not res["ok"]


def test_add_fields_to_flat_pdf(samples):
    boxes = [
        {"page": 1, "name": "full_name", "label": "Full name", "x0": 180, "top": 105, "x1": 440, "bottom": 123},
        {"page": 1, "name": "agree", "label": "Agree", "type": "checkbox", "x0": 260, "top": 255, "x1": 274, "bottom": 269},
    ]
    res = webform.run([samples["b_form_flat"]], {"mode": "add_fields", "boxes": boxes}, samples["out"])
    assert res["ok"], res["message"]
    names = {f["name"]: f["type"] for f in res["data"]["fields"]}
    assert names == {"full_name": "text", "agree": "checkbox"}
    text = PdfReader(res["outputs"][0]["path"]).pages[0].extract_text()
    assert "Event Pass Registration" in text  # original page content kept underneath


def test_form_id_cannot_escape_the_forms_folder(samples):
    for bad in ["../../etc", "..", "abc/../../x", "ZZZZZZZZ", ""]:
        res = webform.run([], _params(samples, mode="schema", form_id=bad), samples["out"])
        assert not res["ok"], bad
