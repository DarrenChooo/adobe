"""Person B: convert. Logic lives in app/pro/convert.py; this file plugs it into the registry."""
from app.pro import convert as impl
from app.pro.adapter import make_tool

TOOL = make_tool("convert", impl, min_files=1, max_files=None)
