def test_upload_info(client, upload):
    fid = upload("a-report-3p.pdf")
    info = client.get(f"/api/files/{fid}/info").json()
    assert info["pages"] == 3 and info["filename"] == "a-report-3p.pdf"


def test_tools_listed(client):
    tools = {t["id"]: t for t in client.get("/api/tools").json()}
    assert "echo" in tools and "run" not in tools["echo"]


def test_echo_roundtrip(upload, run, fetch):
    fid = upload("a-report-3p.pdf")
    res = run("echo", [fid])
    assert res["ok"], res["message"]
    out = res["outputs"][0]
    assert out["filename"] == "a-report-3p.pdf" and out["file_id"] != fid
    assert fetch(out["file_id"]) == fetch(fid)


def test_unknown_tool_and_file(client):
    assert client.post("/api/tools/nope", json={"file_ids": []}).status_code == 404
    assert client.post("/api/tools/echo", json={"file_ids": ["0" * 32]}).status_code == 404
    assert client.get("/api/files/../etc").status_code == 404
