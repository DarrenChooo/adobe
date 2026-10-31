"""Plain-English command bar: the model plans, our real tools do the work.

Tools are passed in, so this runs against a mock list until GET /api/tools exists.
Plain functions for now. Wrap `run` in a ToolSpec once app/core/tooling.py lands.
"""
import json

import jsonschema

from app.core import llm

# These call the model themselves or need a person, so a plan can't include them.
NOT_PLANNABLE = {"assistant_command", "echo"}

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "explanation": {"type": "string"},
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tool_id": {"type": "string"},
                    "params": {"type": "object"},
                    "why": {"type": "string"},
                },
                "required": ["tool_id", "params"],
            },
        },
    },
    "required": ["explanation", "steps"],
}

PLAN_SYSTEM = (
    "You turn a request about PDF files into a plan using only the tools listed. Each step has a "
    "tool_id, params that match that tool's params_schema, and a short why. The first step runs on "
    "the user's selected files, and each later step runs on the previous step's output files. Use "
    "the fewest steps that do what was asked. If no listed tool can do it, return no steps and say "
    "why in explanation. Never invent a tool or a parameter."
)


def _plannable(tools: list[dict]) -> list[dict]:
    return [
        {k: tool.get(k) for k in ("id", "description", "params_schema")}
        for tool in tools if tool["id"] not in NOT_PLANNABLE
    ]


def validate_plan(steps: list[dict], tools: list[dict]) -> list[str]:
    """Problems that stop this plan running: unknown tools or params that break the schema."""
    by_id = {tool["id"]: tool for tool in _plannable(tools)}
    problems = []
    for number, step in enumerate(steps, 1):
        tool = by_id.get(step["tool_id"])
        if tool is None:
            problems.append(f"Step {number}: there is no tool called {step['tool_id']}.")
            continue
        try:
            jsonschema.validate(step["params"], tool.get("params_schema") or {})
        except jsonschema.ValidationError as exc:
            problems.append(f"Step {number} ({step['tool_id']}): {exc.message}")
    return problems


def make_plan(sentence: str, tools: list[dict], file_count: int = 1, model: str | None = None) -> dict:
    user = json.dumps(
        {"request": sentence, "selected_files": file_count, "tools": _plannable(tools)},
        ensure_ascii=False,
    )
    plan = llm.complete(PLAN_SYSTEM, user, json_schema=PLAN_SCHEMA, model=model)
    return {"explanation": plan["explanation"], "steps": plan["steps"],
            "problems": validate_plan(plan["steps"], tools)}


def run_plan(steps: list[dict], tools: list[dict], file_ids: list[str], call_tool) -> dict:
    """Run a plan the user approved. call_tool(tool_id, file_ids, params) is POST /api/tools/{id}."""
    problems = validate_plan(steps, tools)
    if problems:
        return {"ok": False, "message": " ".join(problems), "results": [], "file_ids": file_ids}
    current, results = file_ids, []
    for number, step in enumerate(steps, 1):
        result = call_tool(step["tool_id"], current, step["params"])
        results.append({"tool_id": step["tool_id"], **result})
        if not result.get("ok"):
            return {"ok": False, "message": f"Step {number} ({step['tool_id']}) failed: {result.get('message')}",
                    "results": results, "file_ids": current}
        outputs = [o["file_id"] for o in result.get("outputs", [])]
        current = outputs or current  # tools that only report data pass their inputs along
    return {"ok": True, "message": f"Ran {len(steps)} steps.", "results": results, "file_ids": current}
