"""Metadata for Person B's tools, ready to drop into Person A's ToolSpec.

Each entry: id, name, tier, adobe_feature (SPEC section 3 wording), description,
params_schema (JSON Schema; Person C's command bar reads this to pick options).
"""
from __future__ import annotations

BOX = {
    "type": "object",
    "properties": {
        "page": {"type": "integer", "minimum": 1},
        "x0": {"type": "number"}, "top": {"type": "number"},
        "x1": {"type": "number"}, "bottom": {"type": "number"},
    },
    "required": ["page", "x0", "top", "x1", "bottom"],
}

SPECS = {
    "ocr": {
        "name": "Make scans searchable (OCR)",
        "tier": "pro",
        "adobe_feature": "Turn scans into editable PDFs",
        "description": "Reads the words on scanned pages and adds an invisible text layer so the PDF can be searched and copied. Pages that already have text are left alone.",
        "params_schema": {
            "type": "object",
            "properties": {
                "dpi": {"type": "integer", "enum": [200, 300], "default": 300, "description": "Higher is more accurate but slower."},
                "force": {"type": "boolean", "default": False, "description": "Also redo pages that already have text."},
            },
        },
    },
    "redact": {
        "name": "Redact sensitive info",
        "tier": "pro",
        "adobe_feature": "Redact sensitive content",
        "description": "Finds Singapore NRIC/FIN numbers, SG phone numbers and emails, and removes them for real (the page is rebuilt so the text is gone, then leak-tested). Audit mode checks any PDF for text hidden under black boxes.",
        "params_schema": {
            "type": "object",
            "properties": {
                "mode": {"type": "string", "enum": ["detect", "apply", "audit"], "default": "detect",
                         "description": "detect = list what would be redacted; apply = produce the redacted PDF; audit = find text hidden under existing black boxes."},
                "types": {"type": "array", "items": {"type": "string", "enum": ["nric", "phone", "email"]},
                          "description": "Which kinds to look for. Default: all."},
                "exclude": {"type": "array", "items": {"type": "string"}, "description": "Detected item ids to leave visible."},
                "extra_boxes": {"type": "array", "items": BOX, "description": "Extra areas to black out, in PDF points from the top-left."},
                "ocr": {"type": "boolean", "default": True, "description": "Keep the rest of redacted pages searchable."},
            },
        },
    },
    "compare": {
        "name": "Compare two versions",
        "tier": "pro",
        "adobe_feature": "Compare versions of a PDF",
        "description": "Lists every changed, added and removed line between an old and a new PDF, and makes a side-by-side report with changes boxed in red. Give the old version first.",
        "params_schema": {"type": "object", "properties": {"dpi": {"type": "integer", "default": 100}}},
    },
    "convert": {
        "name": "Convert and export",
        "tier": "standard",
        "adobe_feature": "convert, export",
        "description": "PDF to Word, PDF tables to Excel, PDF to page images or plain text, images to one PDF, and Office files to PDF (if LibreOffice is installed).",
        "params_schema": {
            "type": "object",
            "properties": {
                "target": {"type": "string", "enum": ["docx", "xlsx", "png", "txt", "pdf", "office"],
                           "description": "docx/xlsx/png/txt take a PDF; pdf takes images; office takes a Word/Excel/PowerPoint file."},
                "dpi": {"type": "integer", "default": 150, "description": "Only for png."},
            },
            "required": ["target"],
        },
    },
    "webform": {
        "name": "Create web form",
        "tier": "pro",
        "adobe_feature": "Create web forms",
        "description": "Turns a fillable PDF into a shareable web form at /f/<form_id>; every submission fills a copy of the PDF and is saved. Can also add fillable fields to a flat PDF.",
        "params_schema": {
            "type": "object",
            "properties": {
                "mode": {"type": "string", "enum": ["inspect", "create", "schema", "submit", "responses", "add_fields"], "default": "inspect"},
                "title": {"type": "string"},
                "form_id": {"type": "string"},
                "answers": {"type": "object", "description": "Field name -> value, for submit."},
                "boxes": {"type": "array", "items": {**BOX, "properties": {**BOX["properties"], "name": {"type": "string"},
                          "label": {"type": "string"}, "type": {"type": "string", "enum": ["text", "checkbox"]}}}},
            },
        },
    },
}
