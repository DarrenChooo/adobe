"""Person B: webform. Logic lives in app/pro/webform.py; this file plugs it into the registry."""
from app.core import storage
from app.pro import webform as impl
from app.pro.adapter import make_tool

# Forms always live under the app's own storage folder; a request can't choose another path.
TOOL = make_tool("webform", impl, min_files=0, max_files=1, fixed_params={"storage": str(storage.STORAGE_DIR)})
