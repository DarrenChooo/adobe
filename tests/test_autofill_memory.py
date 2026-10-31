import json

import pytest

from app.tools import autofill, autofill_memory


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(autofill, "CACHE_PATH", tmp_path / "cache.json")
    monkeypatch.setattr(autofill_memory, "NOTES_PATH", tmp_path / "forms.json")
    return tmp_path


def test_list_is_empty_without_files(run):
    res = run("autofill_memory", [], {"action": "list"})
    assert res["ok"], res
    assert res["data"]["forms"] == []


def test_note_list_and_forget(run, tmp_path):
    autofill.CACHE_PATH.write_text(json.dumps({
        "aaa": {"mapping": {"f1": "full_name", "f2": "email"}},
        "bbb": {"mapping": {"x": "nric"}},
    }))
    res = run("autofill_memory", [], {"action": "note", "signature": "aaa", "filename": "event-pass.pdf", "fields": 5})
    assert res["ok"], res

    forms = run("autofill_memory", [], {"action": "list"})["data"]["forms"]
    assert [f["signature"] for f in forms] == ["aaa", "bbb"]  # noted one is newest
    assert forms[0]["name"] == "event-pass.pdf" and forms[0]["fields"] == 5 and forms[0]["last_filled"]
    assert forms[1]["name"] == "A form you filled" and forms[1]["fields"] == 1

    # Notes never hold profile values.
    assert set(json.loads(autofill_memory.NOTES_PATH.read_text())["aaa"]) == {"name", "fields", "last_filled"}

    res = run("autofill_memory", [], {"action": "forget", "signature": "aaa"})
    assert res["ok"] and res["data"]["forgotten"]
    assert "aaa" not in json.loads(autofill.CACHE_PATH.read_text())
    assert "aaa" not in json.loads(autofill_memory.NOTES_PATH.read_text())
    assert [f["signature"] for f in run("autofill_memory", [], {"action": "list"})["data"]["forms"]] == ["bbb"]


def test_noted_but_not_cached_is_not_listed(run):
    run("autofill_memory", [], {"action": "note", "signature": "zzz", "filename": "x.pdf", "fields": [1, 2]})
    assert run("autofill_memory", [], {"action": "list"})["data"]["forms"] == []


def test_forget_with_no_files_succeeds(run):
    res = run("autofill_memory", [], {"action": "forget", "signature": "nope"})
    assert res["ok"] and res["data"]["forgotten"] is False


def test_missing_signature_is_a_clean_error(run):
    res = run("autofill_memory", [], {"action": "forget"})
    assert not res["ok"] and "signature" in res["message"]
