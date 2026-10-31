import json

import pytest
from pypdf import PdfReader
from reportlab.lib.colors import black
from reportlab.pdfgen import canvas

from app.tools import autofill

PROFILE = {
    "full_name": "Zqx Testperson",
    "surname": "Testperson",
    "given_name": "Zqx",
    "nric": "S1234567D",
    "date_of_birth": "2003-04-09",
    "sex": "Male",
    "address_line1": "99 Madeup Lane",
    "city": "Singapore",
    "postal_code": "123456",
    "email": "zqx@example.com",
}


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(autofill, "PROFILE_PATH", tmp_path / "profile.json")
    monkeypatch.setattr(autofill, "CACHE_PATH", tmp_path / "cache.json")


@pytest.fixture
def form(tmp_path):
    path = tmp_path / "form.pdf"
    c = canvas.Canvas(str(path))
    c.drawString(50, 760, "Surname")
    c.acroForm.textfield(name="txtLName_1", x=50, y=730, width=200, height=20, borderColor=black)
    c.acroForm.textfield(name="fld2", tooltip="Email address", x=50, y=690, width=200, height=20, borderColor=black)
    c.acroForm.checkbox(name="agree", x=50, y=650, buttonStyle="check", tooltip="I agree")
    c.acroForm.choice(name="sex", tooltip="Sex", options=["M", "F"], value="M", x=50, y=610, width=80, height=20)
    c.save()
    return path


def fake_model(monkeypatch, answer):
    calls = []

    def complete(system, user, json_schema=None, model=None):
        calls.append(system + user)
        return answer(user) if callable(answer) else answer

    monkeypatch.setattr(autofill.llm, "complete", complete)
    return calls


def test_reads_fields_and_uses_printed_label_when_no_tooltip(form):
    fields = {f["name"]: f for f in autofill.read_fields(form)}
    assert fields["txtLName_1"]["label"] == "Surname"
    assert fields["fld2"]["tooltip"] == "Email address"
    assert fields["sex"]["type"] == "choice"
    assert fields["sex"]["options"] == ["M", "F"]


def test_model_never_sees_profile_values(form, monkeypatch):
    calls = fake_model(monkeypatch, {"mappings": []})
    autofill.map_fields(form, PROFILE)
    sent = calls[0]
    for value in autofill.derive_profile(PROFILE).values():
        assert value not in sent, value
    assert "surname" in sent  # the keys do go


def test_ignores_keys_the_profile_does_not_have(form, monkeypatch):
    fake_model(monkeypatch, {"mappings": [{"id": 0, "key": "made_up_key", "confidence": 0.9}]})
    rows = autofill.map_fields(form, PROFILE)["fields"]
    assert rows[0]["key"] is None


def test_low_confidence_is_flagged(form, monkeypatch):
    fake_model(monkeypatch, {"mappings": [{"id": 0, "key": "surname", "confidence": 0.4}]})
    row = autofill.map_fields(form, PROFILE)["fields"][0]
    assert row["value"] == "Testperson"
    assert row["needs_review"] is True


def test_fill_writes_values_and_coerces_choice(form, tmp_path):
    out = tmp_path / "out.pdf"
    result = autofill.fill_form(form, {"txtLName_1": "Testperson", "sex": "Male", "nope": "x"}, out)
    fields = PdfReader(out).get_fields()
    assert fields["txtLName_1"]["/V"] == "Testperson"
    assert fields["sex"]["/V"] == "M"
    assert result["skipped"] == ["nope"]


def test_corrections_are_remembered_and_skip_the_model(form, tmp_path, monkeypatch):
    calls = fake_model(monkeypatch, {"mappings": [{"id": 0, "key": "given_name", "confidence": 0.9}]})
    first = autofill.map_fields(form, PROFILE)
    assert first["source"] == "model"

    autofill.apply_review(form, first["signature"], PROFILE, {"txtLName_1": "surname"}, None, tmp_path / "out.pdf")

    second = autofill.map_fields(form, PROFILE)
    assert len(calls) == 1
    assert second["source"] == "learned"
    assert second["fields"][0]["key"] == "surname"
    assert second["fields"][0]["value"] == "Testperson"


def test_memory_keeps_keys_not_values(form, tmp_path, monkeypatch):
    autofill.apply_review(form, "sig", PROFILE, {"txtLName_1": "surname"}, {"fld2": "typed@secret.example"}, tmp_path / "o.pdf")
    stored = autofill.CACHE_PATH.read_text(encoding="utf-8")
    assert "surname" in stored
    assert "Testperson" not in stored and "typed@secret.example" not in stored


def test_flat_pdf_is_refused(tmp_path):
    path = tmp_path / "flat.pdf"
    c = canvas.Canvas(str(path))
    c.drawString(50, 760, "no fields")
    c.save()
    with pytest.raises(autofill.FormError):
        autofill.map_fields(path, PROFILE)


@pytest.mark.parametrize("name,field", [
    ("irs_w4.pdf", "topmostSubform[0].Page1[0].Step1a[0].f1_02[0]"),
    ("uscis_g1145.pdf", "form1[0].#subform[0].LastName[0]"),
    ("uscis_i9.pdf", "Last Name (Family Name)"),
])
def test_fills_real_forms_and_removes_the_xfa_copy(name, field, tmp_path):
    source = f"samples/forms/{name}"
    assert field in {f["name"] for f in autofill.read_fields(source)}
    out = tmp_path / "out.pdf"
    assert autofill.fill_form(source, {field: "Testperson"}, out)["filled"] == [field]
    reader = PdfReader(out)
    assert reader.get_fields()[field]["/V"] == "Testperson"
    assert "/XFA" not in reader.trailer["/Root"]["/AcroForm"]


def test_derived_values():
    values = autofill.derive_profile(PROFILE)
    assert values["date_of_birth_mmddyyyy"] == "04/09/2003"
    assert values["date_of_birth_ddmmyyyy"] == "09/04/2003"
    assert values["city_state_postal_code"] == "Singapore, 123456"


def test_ground_truth_names_real_fields():
    truth = json.load(open("samples/forms/ground_truth.json", encoding="utf-8"))
    for filename, rules in truth.items():
        if filename.startswith("_"):
            continue
        shorts = [f["name"].split(".")[-1].removesuffix("[0]") for f in autofill.read_fields(f"samples/forms/{filename}")]
        for pattern in rules:
            hit = any(s.startswith(pattern[:-1]) for s in shorts) if pattern.endswith("*") else pattern in shorts
            assert hit, f"{filename}: {pattern}"
