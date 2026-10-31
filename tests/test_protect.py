import io

from pypdf import PdfReader


def test_protect_then_unlock(upload, run, fetch, client):
    res = run("protect", [upload("a-report-3p.pdf")], {"password": "1234", "allow_copy": False})
    assert res["ok"], res["message"]
    data = fetch(res["outputs"][0]["file_id"])
    r = PdfReader(io.BytesIO(data))
    assert r.is_encrypted
    assert not r.decrypt("wrong")
    assert r.decrypt("1234")
    assert r._encryption.V == 5  # AES-256

    locked = client.post("/api/files", files={"file": ("locked.pdf", data)}).json()["file_id"]
    assert not run("unlock", [locked], {"password": "nope"})["ok"]
    res = run("unlock", [locked], {"password": "1234"})
    assert res["ok"]
    assert not PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"]))).is_encrypted


def test_protect_needs_password(upload, run):
    assert not run("protect", [upload("a-report-3p.pdf")], {})["ok"]
