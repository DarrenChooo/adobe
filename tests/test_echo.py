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


def test_run_wrapper_accepts_dict_results(tmp_path):
    from app.core.tooling import RunContext, ToolSpec, run_tool

    f = tmp_path / "x.txt"
    f.write_text("hi")
    spec = ToolSpec(id="d", name="d", tier="ours", adobe_feature="", description="", params_schema={},
                    run=lambda i, p, c: {"ok": True, "message": "m", "outputs": [{"path": str(f), "filename": "x.txt", "mime": "text/plain"}], "data": {}})
    res = run_tool(spec, [], {}, RunContext(tmp_path, [], []))
    assert res.ok and res.message == "m" and res.outputs[0]["filename"] == "x.txt"


def test_unknown_tool_and_file(client):
    assert client.post("/api/tools/nope", json={"file_ids": []}).status_code == 404
    assert client.post("/api/tools/echo", json={"file_ids": ["0" * 32]}).status_code == 404
    assert client.get("/api/files/../etc").status_code == 404
