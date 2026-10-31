"""Run a Person B tool from the command line, before the web app exists.

  .venv/bin/python -m app.pro.cli redact samples/b_pii_letter.pdf --params '{"mode": "apply"}'
"""
from __future__ import annotations

import argparse
import importlib
import json
from pathlib import Path

TOOLS = ["ocr", "redact", "compare", "convert"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("tool", choices=TOOLS)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--params", default="{}")
    ap.add_argument("--out", default="out")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    mod = importlib.import_module(f"app.pro.{args.tool}")
    print(json.dumps(mod.run([Path(f) for f in args.files], json.loads(args.params), out), indent=2, default=str))


if __name__ == "__main__":
    main()
