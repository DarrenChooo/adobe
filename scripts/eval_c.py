"""Person C's measured numbers. Run from the repo root:

    python scripts/eval_c.py models            which model returns clean JSON most reliably
    python scripts/eval_c.py autofill          fields correct on the real forms
    python scripts/eval_c.py qa                correct citations and refusals
    python scripts/eval_c.py command           plans with the right tools
    python scripts/eval_c.py all

Results go to docs/findings/c-eval.json. Uses a made-up profile and public forms only.
"""
import argparse
import json
import os
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import llm  # noqa: E402
from app.tools import assistant_command, assistant_qa, autofill  # noqa: E402

SAMPLES = Path("samples")
RESULTS = Path("docs/findings/c-eval.json")

# Stand-ins for Person A's and Person B's tools, until GET /api/tools exists.
MOCK_TOOLS = [
    {"id": "merge", "description": "Combine several PDFs into one, in order.", "params_schema": {"type": "object", "properties": {}}},
    {"id": "split", "description": "Split a PDF by page ranges such as 1-3,5, or every N pages.", "params_schema": {"type": "object", "properties": {"ranges": {"type": "string"}, "every": {"type": "integer"}}}},
    {"id": "organize", "description": "Reorder, rotate, delete or extract pages.", "params_schema": {"type": "object", "properties": {"rotate": {"type": "object"}, "delete": {"type": "array"}, "order": {"type": "array"}}}},
    {"id": "compress", "description": "Make a PDF smaller by compressing streams and downsampling images.", "params_schema": {"type": "object", "properties": {"quality": {"type": "string"}}}},
    {"id": "protect", "description": "Add an AES-256 password and permissions to a PDF.", "params_schema": {"type": "object", "properties": {"password": {"type": "string"}}, "required": ["password"]}},
    {"id": "ocr", "description": "Turn a scanned PDF into a searchable PDF.", "params_schema": {"type": "object", "properties": {}}},
    {"id": "redact", "description": "Permanently remove sensitive content such as NRICs, phone numbers, emails and names.", "params_schema": {"type": "object", "properties": {"detect": {"type": "array", "items": {"type": "string"}}}}},
    {"id": "convert", "description": "Convert a PDF to Word, Excel, PNG images or plain text.", "params_schema": {"type": "object", "properties": {"to": {"type": "string", "enum": ["docx", "xlsx", "png", "txt"]}}, "required": ["to"]}},
    {"id": "compare", "description": "Find the differences between two versions of a PDF.", "params_schema": {"type": "object", "properties": {}}},
]

COMMANDS = [
    ("merge these two and compress", 2, ["merge", "compress"]),
    ("redact all NRICs", 1, ["redact"]),
    ("password-protect with 1234", 1, ["protect"]),
    ("make this scan searchable, then password-protect it with abc", 1, ["ocr", "protect"]),
    ("keep only pages 1 to 3 as a separate file", 1, ["split"]),
    ("turn this into a Word document", 1, ["convert"]),
    ("rotate page 2 by 90 degrees", 1, ["organize"]),
    ("compress this and add the password hunter2", 1, ["compress", "protect"]),
    ("what changed between these two versions?", 2, ["compare"]),
    ("book me a flight to Tokyo", 1, []),
    ("order a pizza", 1, []),
]


def _stats_since(start: int) -> dict:
    calls = [c for c in llm.CALL_LOG[start:] if c["ok"]]
    if not calls:
        return {"calls": 0}
    average = lambda key: round(statistics.mean(c[key] or 0 for c in calls), 1)
    return {"calls": len(calls), "avg_tokens_in": average("tokens_in"),
            "avg_tokens_out": average("tokens_out"), "avg_seconds": average("seconds")}


def eval_models(names: list[str] | None) -> dict:
    client = llm._client()
    if not names:
        names = [m.id for m in client.models.list().data]
    print("models:", names)
    profile = json.loads((SAMPLES / "profile.sample.json").read_text(encoding="utf-8"))
    results = {}
    for name in names:
        ok, seconds = 0, []
        for _ in range(3):
            started = time.monotonic()
            try:
                autofill.map_fields_uncached(SAMPLES / "forms" / "uscis_g1145.pdf", profile, model=name)
                ok += 1
            except Exception as exc:
                print(f"  {name}: {type(exc).__name__}")
            seconds.append(round(time.monotonic() - started, 1))
        results[name] = {"valid_json": f"{ok}/3", "seconds": seconds}
        print(name, results[name], flush=True)
    return results


def _accepted(rules: dict, short_name: str) -> list:
    for pattern, accepted in rules.items():
        if pattern == short_name or (pattern.endswith("*") and short_name.startswith(pattern[:-1])):
            return accepted
    return [None]


def eval_autofill(model: str | None) -> dict:
    truth = json.loads((SAMPLES / "forms" / "ground_truth.json").read_text(encoding="utf-8"))
    profile = json.loads((SAMPLES / "profile.sample.json").read_text(encoding="utf-8"))
    totals = {"fields": 0, "correct": 0, "must_fill": 0, "must_fill_correct": 0, "wrong_fills": 0}
    forms, mistakes = {}, []
    start = len(llm.CALL_LOG)
    for filename, rules in truth.items():
        if filename.startswith("_"):
            continue
        rows = autofill.map_fields_uncached(SAMPLES / "forms" / filename, profile, model=model)["fields"]
        score = dict.fromkeys(totals, 0)
        for row in rows:
            short = row["field"].split(".")[-1].removesuffix("[0]")
            accepted = _accepted(rules, short)
            right = row["key"] in accepted
            score["fields"] += 1
            score["correct"] += right
            if None not in accepted:
                score["must_fill"] += 1
                score["must_fill_correct"] += right
            if row["key"] and not right:
                score["wrong_fills"] += 1
            if not right:
                mistakes.append({"form": filename, "field": short, "shown_as": row["shown_as"][:90],
                                 "got": row["key"], "accepted": accepted, "confidence": row["confidence"]})
        forms[filename] = score
        for key in totals:
            totals[key] += score[key]
        print(filename, score, flush=True)
    return {"totals": totals, "forms": forms, "mistakes": mistakes, "cost": _stats_since(start)}


def eval_qa(model: str | None) -> dict:
    questions = json.loads((SAMPLES / "qa_questions.json").read_text(encoding="utf-8"))
    results = {"answerable": [], "unanswerable": []}
    start = len(llm.CALL_LOG)
    for item in questions["answerable"]:
        reply = assistant_qa.ask(SAMPLES / "forms" / item["file"], item["question"], model=model)
        right_page = any(c["verified"] and c["page"] == item["page"] for c in reply["citations"])
        contains = item["answer_contains"].lower() in reply["answer"].lower()
        correct = reply["found"] and right_page and contains and reply["all_verified"]
        results["answerable"].append({"question": item["question"], "correct": correct, "right_page": right_page,
                                      "contains": contains, "all_verified": reply["all_verified"],
                                      "answer": reply["answer"][:200], "citations": reply["citations"]})
        print("Q", correct, item["question"], flush=True)
    for item in questions["unanswerable"]:
        reply = assistant_qa.ask(SAMPLES / "forms" / item["file"], item["question"], model=model)
        results["unanswerable"].append({"question": item["question"], "refused": not reply["found"],
                                        "answer": reply["answer"][:200]})
        print("R", not reply["found"], item["question"], flush=True)
    results["correct_citations"] = f"{sum(r['correct'] for r in results['answerable'])}/{len(results['answerable'])}"
    results["correct_refusals"] = f"{sum(r['refused'] for r in results['unanswerable'])}/{len(results['unanswerable'])}"
    results["cost"] = _stats_since(start)
    return results


def eval_command(model: str | None) -> dict:
    results = []
    start = len(llm.CALL_LOG)
    for sentence, file_count, expected in COMMANDS:
        plan = assistant_command.make_plan(sentence, MOCK_TOOLS, file_count, model=model)
        got = [step["tool_id"] for step in plan["steps"]]
        right = got == expected and not plan["problems"]
        results.append({"command": sentence, "expected": expected, "got": got, "problems": plan["problems"],
                        "params": [s["params"] for s in plan["steps"]], "right": right})
        print(right, sentence, got, plan["problems"], flush=True)
    return {"right_plans": f"{sum(r['right'] for r in results)}/{len(results)}", "results": results,
            "note": "Tool list is a stand-in until Person A's and Person B's real tools exist.",
            "cost": _stats_since(start)}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("what", choices=["models", "autofill", "qa", "command", "all"])
    parser.add_argument("--model", default=None)
    parser.add_argument("--models", nargs="*", default=None)
    args = parser.parse_args()

    results = json.loads(RESULTS.read_text(encoding="utf-8")) if RESULTS.exists() else {}
    runs = {"autofill": eval_autofill, "qa": eval_qa, "command": eval_command}
    if args.what == "models":
        results["models"] = eval_models(args.models)
    for name, function in runs.items():
        if args.what in (name, "all"):
            results[name] = function(args.model)
            results[name]["model"] = args.model or os.environ.get("LLM_MODEL")
            summary = {k: v for k, v in results[name].items() if k not in ("mistakes", "results", "answerable", "unanswerable", "forms")}
            print(name, json.dumps(summary), flush=True)
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    RESULTS.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print("wrote", RESULTS)


if __name__ == "__main__":
    main()
