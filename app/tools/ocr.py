"""Person B: ocr. Logic lives in app/pro/ocr.py; this file plugs it into the registry."""
from app.pro import ocr as impl
from app.pro.adapter import make_tool

TOOL = make_tool("ocr", impl, min_files=1, max_files=1)
