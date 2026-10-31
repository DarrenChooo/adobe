"""Plain-English command bar: the model plans, our real tools do the work.

The model only returns a plan. Nothing runs until the user approves it, and then each
step goes through the same POST /api/tools/{id} route as the rest of the app.
"""
import json
from pathlib import Path

import jsonschema

from app.core import llm, storage
from app.core.tooling import REGISTRY, Output, RunContext, ToolError, ToolResult, ToolSpec

# These need a person at the screen (review, signing, drawing), or are the bar itself.
NOT_PLANNABLE = {"assistant_command", "echo", "autofill", "esign", "webform", "fill_sign", "annotate", "spaces"}

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
        {k: tool.get(k) for k in ("id", "description", "params_schema", "min_files", "max_files")}
        for tool in tools if tool["id"] not in NOT_PLANNABLE
    ]


def validate_plan(steps: list[dict], tools: list[dict], file_count: int | None = None) -> list[str]:
    """Problems that stop this plan running: unknown tools, bad params, wrong number of files."""
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
        if number == 1 and file_count is not None:
            low, high = tool.get("min_files") or 0, tool.get("max_files")
            if file_count < low or (high is not None and file_count > high):
                wanted = f"{low}" if high == low else f"at least {low}" if high is None else f"{low} to {high}"
                problems.append(f"Step 1 ({step['tool_id']}) needs {wanted} file(s), and {file_count} are selected.")
    return problems


def make_plan(sentence: str, tools: list[dict], file_count: int = 1, model: str | None = None) -> dict:
    user = json.dumps(
        {"request": sentence, "selected_files": file_count, "tools": _plannable(tools)},
        ensure_ascii=False,
    )
    plan = llm.complete(PLAN_SYSTEM, user, json_schema=PLAN_SCHEMA, model=model)
    return {"explanation": plan["explanation"], "steps": plan["steps"],
            "problems": validate_plan(plan["steps"], tools, file_count)}


def run_plan(steps: list[dict], tools: list[dict], file_ids: list[str], call_tool) -> dict:
    """Run a plan the user approved. call_tool(tool_id, file_ids, params) is POST /api/tools/{id}."""
    problems = validate_plan(steps, tools, len(file_ids))
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


def _real_tools() -> list[dict]:
    return [spec.public() for spec in REGISTRY.values()]


def _call_real_tool(tool_id: str, file_ids: list[str], params: dict) -> dict:
    from app.main import RunBody, call_tool  # imported here because app.main imports the tools

    return json.loads(call_tool(tool_id, RunBody(file_ids=file_ids, params=params)).body)


def run(inputs: list[Path], params: dict, ctx: RunContext) -> ToolResult:
    if params.get("action", "plan") == "plan":
        sentence = (params.get("sentence") or "").strip()
        if not sentence:
            raise ToolError("Type what you want done.")
        plan = make_plan(sentence, _real_tools(), len(ctx.file_ids))
        return ToolResult(ok=True, message=plan["explanation"], data=plan)

    done = run_plan(params.get("steps") or [], _real_tools(), ctx.file_ids, _call_real_tool)
    if not done["ok"]:
        return ToolResult(ok=False, message=done["message"], data={"results": done["results"]})
    made = [o for step in done["results"][-1:] for o in step.get("outputs", [])]
    outputs = [Output(storage.get_path(o["file_id"]), o["filename"], o["mime"]) for o in made]
    return ToolResult(ok=True, message=done["message"], outputs=outputs,
                      data={"steps": [{"tool_id": r["tool_id"], "message": r.get("message", "")} for r in done["results"]]})


TOOL = ToolSpec(
    id="assistant_command",
    name="Tell it what to do",
    tier="studio",
    adobe_feature="Ask AI to edit, convert, and compress PDFs",
    description="Say what you want in plain English. The AI proposes a plan using our real tools, and you approve it before anything runs.",
    params_schema={
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["plan", "run"], "default": "plan"},
            "sentence": {"type": "string", "description": "What the user wants done"},
            "steps": {"type": "array", "description": "For run: the plan the user approved"},
        },
    },
    run=run,
)
