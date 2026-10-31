"""Person B: compare. Logic lives in app/pro/compare.py; this file plugs it into the registry."""
from app.pro import compare as impl
from app.pro.adapter import make_tool

TOOL = make_tool("compare", impl, min_files=2, max_files=2)
