from b_fixtures import samples  # noqa: F401  (pytest fixture)

from app.pro import redact
from app.pro.pdfio import all_text


def test_detect_finds_every_planted_value_and_no_decoys(samples):
    res = redact.run([samples["letter"]], {"mode": "detect"}, samples["out"])
    found = {h["text"] for h in res["data"]["hits"]}
    truth = samples["truth"]["planted"]
    for kind in ("nric", "phone", "email"):
        for value in truth[kind]:
            assert value in found, f"missed {kind} {value}"
    for decoy in truth["decoys"]:
        assert decoy not in found, f"false positive {decoy}"


def test_apply_removes_text_for_real(samples):
    res = redact.run([samples["letter"]], {"mode": "apply"}, samples["out"])
    assert res["ok"], res["message"]
    assert res["data"]["leak_test"] == "pass", res["data"]["leaked"]
    text = "\n".join(all_text(res["outputs"][0]["path"])).replace(" ", "")
    for kind in ("nric", "phone", "email"):
        for value in samples["truth"]["planted"][kind]:
            assert value.replace(" ", "") not in text
    assert "TanWeiMing" in text  # the rest of the page is still searchable


def test_scan_is_ocrd_then_redacted(samples):
    res = redact.run([samples["scan"]], {"mode": "apply"}, samples["out"])
    assert res["ok"] and res["data"]["ocr_first"] is True
    assert res["data"]["by_type"].get("nric", 0) >= 2, res["data"]
    assert res["data"]["leak_test"] == "pass", res["data"]["leaked"]
    text = "\n".join(all_text(res["outputs"][0]["path"])).replace(" ", "")
    assert "1234567D" not in text and "0123456Z" not in text


def test_audit_catches_naive_black_boxes(samples):
    res = redact.run([samples["naive"]], {"mode": "audit"}, samples["out"])
    hidden = " ".join(h["hidden_text"] for h in res["data"]["hidden"])
    assert "S1234567D" in hidden and "T0123456Z" in hidden


def test_audit_passes_our_own_output(samples):
    applied = redact.run([samples["naive"]], {"mode": "apply"}, samples["out"])
    res = redact.run([applied["outputs"][0]["path"]], {"mode": "audit"}, samples["out"])
    assert res["data"]["hidden"] == []
