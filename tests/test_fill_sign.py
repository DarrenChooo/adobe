import base64
import io

from PIL import Image
from pypdf import PdfReader


def sig_png() -> str:
    img = Image.new("RGBA", (200, 60), (0, 0, 0, 0))
    for x in range(10, 190):
        img.putpixel((x, 30 + (x % 7) - 3), (20, 40, 110, 255))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def test_list_fields(upload, run):
    res = run("fill_sign", [upload("a-form-fields.pdf")], {"action": "list"})
    fields = {f["name"]: f for f in res["data"]["fields"]}
    assert fields["txtLName_1"]["tooltip"] == "Surname / family name"
    assert fields["cboType"]["type"] == "choice" and "Student" in fields["cboType"]["options"]
    assert fields["chkAgree"]["type"] == "checkbox"
    r = fields["txtLName_1"]["rect"]
    assert 0 < r["x"] < 1 and 0 < r["y"] < 0.3


def test_fill_and_sign(upload, run, fetch):
    fid = upload("a-form-fields.pdf")
    res = run("fill_sign", [fid], {
        "values": {"txtLName_1": "Tan", "txtFName_1": "Mei Ling", "cboType": "Student", "chkAgree": True},
        "stamps": [{"page": 1, "x": 0.25, "y": 0.75, "w": 0.3, "h": 0.06, "kind": "image", "image": sig_png()}],
    })
    assert res["ok"], res["message"]
    r = PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"])))
    f = r.get_fields()
    assert f["txtLName_1"]["/V"] == "Tan" and f["cboType"]["/V"] == "Student"
    assert f["chkAgree"]["/V"] == "/Yes"
    assert r.pages[0].images, "signature image should be on page 1"


def test_flatten(upload, run, fetch):
    res = run("fill_sign", [upload("a-form-fields.pdf")], {"values": {"txtLName_1": "Tan"}, "flatten": True})
    r = PdfReader(io.BytesIO(fetch(res["outputs"][0]["file_id"])))
    assert not r.get_fields()
    assert "Tan" in r.pages[0].extract_text()


def test_unknown_field(upload, run):
    assert not run("fill_sign", [upload("a-form-fields.pdf")], {"values": {"nope": "x"}})["ok"]
