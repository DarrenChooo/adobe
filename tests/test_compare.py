from tests.b_fixtures import samples  # noqa: F401

from app.pro import compare


def test_finds_all_planted_edits(samples):
    res = compare.run([samples["b_contract_v1"], samples["b_contract_v2"]], {}, samples["out"])
    assert res["ok"]
    changes = res["data"]["text_changes"]
    before = " ".join(l for c in changes for l in c["before"])
    after = " ".join(l for c in changes for l in c["after"])
    assert "Sample Trading Co." in before and "Sample Holdings Co." in after
    assert "SGD 1,200" in before and "SGD 1,500" in after
    assert "confidential" in before
    assert "Weekend support" in after
    assert "12 months" in before and "24 months" in after
    assert res["data"]["visual_region_count"] >= 1


def test_identical_files_have_no_changes(samples):
    res = compare.run([samples["b_contract_v1"], samples["b_contract_v1"]], {}, samples["out"])
    assert res["data"]["text_change_count"] == 0 and res["data"]["visual_region_count"] == 0
