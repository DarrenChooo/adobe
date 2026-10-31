import io

from pypdf import PdfReader

from test_fill_sign import sig_png

BOXES = [{"kind": "signature", "page": 3, "x": 0.1, "y": 0.8, "w": 0.3, "h": 0.06},
         {"kind": "date", "page": 3, "x": 0.6, "y": 0.8, "w": 0.2, "h": 0.03}]


def test_full_loop(upload, run, fetch):
    fid = upload("a-report-3p.pdf")
    res = run("esign", [fid], {"action": "create", "signer_email": "signer@example.com", "signer_name": "Alex Lim", "fields": BOXES})
    assert res["ok"], res["message"]
    req = res["data"]["requests"][0]
    assert req["status"] == "sent" and req["link"] == f"/sign/{req['id']}"

    opened = run("esign", [], {"action": "open", "request_id": req["id"]})
    assert opened["data"]["request"]["status"] == "viewed"
    assert "file_hash" not in opened["data"]["request"]

    signed = run("esign", [], {"action": "sign", "request_id": req["id"], "signature": sig_png()})
    assert signed["ok"], signed["message"]
    d = signed["data"]["request"]
    assert d["status"] == "signed" and d["signed_file_id"]
    r = PdfReader(io.BytesIO(fetch(d["signed_file_id"])))
    assert len(r.pages) == 4  # 3 + audit page
    assert r.pages[2].images
    assert "Signature audit trail" in r.pages[3].extract_text()

    status = run("esign", [], {"action": "status", "request_id": req["id"]})
    assert [a["event"] for a in status["data"]["audit"]] == ["created", "viewed", "signed", "completed"]
    assert not run("esign", [], {"action": "sign", "request_id": req["id"], "signature": sig_png()})["ok"]


def test_template_and_bulk(upload, run):
    fid = upload("a-report-3p.pdf")
    t = run("esign", [], {"action": "template_save", "name": "Last page", "fields": BOXES})
    tid = t["data"]["template_id"]
    res = run("esign", [fid], {"action": "bulk", "template_id": tid, "csv": "email,name\na@example.com,A One\nb@example.com,B Two\n"})
    assert res["ok"], res["message"]
    reqs = res["data"]["requests"]
    assert len(reqs) == 2 and len({r["id"] for r in reqs}) == 2
    assert reqs[1]["fields"][0]["page"] == 3


def test_branding_and_custom_url(upload, run):
    run("esign", [], {"action": "branding_set", "company": "Sample Pte Ltd", "color": "#0055aa"})
    assert run("esign", [], {"action": "branding_get"})["data"]["branding"]["company"] == "Sample Pte Ltd"

    assert not run("esign", [], {"action": "branding_set", "public_url": "sign.example.com"})["ok"]
    run("esign", [], {"action": "branding_set", "public_url": "https://sign.example.com/"})
    req = run("esign", [upload("a-report-3p.pdf")], {"action": "create", "signer_email": "u@example.com", "fields": BOXES})["data"]["requests"][0]
    assert req["url"] == f"https://sign.example.com/sign/{req['id']}"
    listed = run("esign", [], {"action": "list"})["data"]["requests"]
    assert listed[0]["url"].startswith("https://sign.example.com/sign/")

    run("esign", [], {"action": "branding_set", "public_url": ""})
    req = run("esign", [upload("a-report-3p.pdf")], {"action": "create", "signer_email": "u@example.com", "fields": BOXES})["data"]["requests"][0]
    assert req["url"] is None  # the UI falls back to its own address


def test_bad_inputs(upload, run):
    fid = upload("a-report-3p.pdf")
    assert not run("esign", [fid], {"action": "create", "signer_email": "x@example.com", "fields": []})["ok"]
    assert not run("esign", [fid], {"action": "create", "signer_email": "nope", "fields": BOXES})["ok"]
    assert not run("esign", [], {"action": "open", "request_id": "missing"})["ok"]
