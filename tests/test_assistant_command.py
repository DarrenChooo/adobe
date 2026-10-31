from app.tools import assistant_command

TOOLS = [
    {"id": "merge", "description": "Combine PDFs", "params_schema": {"type": "object", "properties": {}}},
    {"id": "compress", "description": "Shrink", "params_schema": {"type": "object", "properties": {}}},
    {"id": "protect", "description": "Password", "params_schema": {
        "type": "object", "properties": {"password": {"type": "string"}}, "required": ["password"]}},
    {"id": "assistant_command", "description": "This bar", "params_schema": {}},
]


def fake_plan(monkeypatch, steps):
    seen = []

    def complete(system, user, json_schema=None, model=None):
        seen.append(user)
        return {"explanation": "Plan", "steps": steps}

    monkeypatch.setattr(assistant_command.llm, "complete", complete)
    return seen


def test_valid_plan_has_no_problems(monkeypatch):
    fake_plan(monkeypatch, [{"tool_id": "merge", "params": {}}, {"tool_id": "compress", "params": {}}])
    assert assistant_command.make_plan("merge and compress", TOOLS, 2)["problems"] == []


def test_invented_tool_is_caught(monkeypatch):
    fake_plan(monkeypatch, [{"tool_id": "teleport", "params": {}}])
    assert "teleport" in assistant_command.make_plan("x", TOOLS)["problems"][0]


def test_bad_params_are_caught(monkeypatch):
    fake_plan(monkeypatch, [{"tool_id": "protect", "params": {}}])
    assert "password" in assistant_command.make_plan("x", TOOLS)["problems"][0]


def test_the_bar_cannot_call_itself(monkeypatch):
    seen = fake_plan(monkeypatch, [{"tool_id": "assistant_command", "params": {}}])
    plan = assistant_command.make_plan("x", TOOLS)
    assert plan["problems"]
    assert '"assistant_command"' not in seen[0]


def test_outputs_pass_to_the_next_step():
    calls = []

    def call_tool(tool_id, file_ids, params):
        calls.append((tool_id, file_ids))
        return {"ok": True, "message": "", "outputs": [{"file_id": f"{tool_id}-out"}], "data": {}}

    steps = [{"tool_id": "merge", "params": {}}, {"tool_id": "compress", "params": {}}]
    result = assistant_command.run_plan(steps, TOOLS, ["a", "b"], call_tool)
    assert result["ok"] is True
    assert calls == [("merge", ["a", "b"]), ("compress", ["merge-out"])]
    assert result["file_ids"] == ["compress-out"]


def test_a_failed_step_stops_the_plan():
    calls = []

    def call_tool(tool_id, file_ids, params):
        calls.append(tool_id)
        return {"ok": False, "message": "broken", "outputs": []}

    steps = [{"tool_id": "merge", "params": {}}, {"tool_id": "compress", "params": {}}]
    result = assistant_command.run_plan(steps, TOOLS, ["a"], call_tool)
    assert result["ok"] is False
    assert calls == ["merge"]


def test_invalid_plan_never_runs():
    def call_tool(*args):
        raise AssertionError("should not run")

    result = assistant_command.run_plan([{"tool_id": "protect", "params": {}}], TOOLS, ["a"], call_tool)
    assert result["ok"] is False
