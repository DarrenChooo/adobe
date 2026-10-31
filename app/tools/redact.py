"""Person B: redact. Logic lives in app/pro/redact.py; this file plugs it into the registry."""
from app.pro import redact as impl
from app.pro.adapter import make_tool

TOOL = make_tool("redact", impl, min_files=1, max_files=1)
