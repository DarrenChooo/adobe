import pytest

from app.core import llm

SCHEMA = {"type": "object", "properties": {"a": {"type": "integer"}}, "required": ["a"]}


@pytest.fixture(autouse=True)
def model_set(monkeypatch):
    monkeypatch.setenv("LLM_MODEL", "test-model")


def replies(monkeypatch, *answers):
    queue = list(answers)
    calls = []

    def chat(messages, model):
        calls.append(messages)
        return queue.pop(0)

    monkeypatch.setattr(llm, "_chat", chat)
    return calls


@pytest.mark.parametrize("text", [
    '{"a": 1}',
    '```json\n{"a": 1}\n```',
    'Sure, here it is: {"a": 1} hope that helps',
    '<think>maybe {"b": 2}?</think>{"a": 1}',
])
def test_extracts_json_from_messy_replies(text):
    assert llm.extract_json(text) == {"a": 1}


def test_returns_validated_dict(monkeypatch):
    replies(monkeypatch, '{"a": 1}')
    assert llm.complete("s", "u", json_schema=SCHEMA) == {"a": 1}


def test_retries_once_with_the_error(monkeypatch):
    calls = replies(monkeypatch, "not json", '{"a": 2}')
    assert llm.complete("s", "u", json_schema=SCHEMA) == {"a": 2}
    assert len(calls) == 2
    assert "invalid" in calls[1][-1]["content"]


def test_schema_failure_retries_then_raises(monkeypatch):
    calls = replies(monkeypatch, '{"a": "x"}', '{"a": "y"}')
    with pytest.raises(llm.LLMError):
        llm.complete("s", "u", json_schema=SCHEMA)
    assert len(calls) == 2


def test_plain_text_strips_reasoning(monkeypatch):
    replies(monkeypatch, "<think>hmm</think> Hello")
    assert llm.complete("s", "u") == "Hello"


def test_missing_key_gives_a_clear_error(monkeypatch):
    monkeypatch.delenv("SOCLAAS_API_KEY", raising=False)
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    with pytest.raises(llm.LLMError, match="SOCLAAS_API_KEY"):
        llm._client()


def test_detect_pii_drops_anything_not_in_the_text(monkeypatch):
    replies(monkeypatch, '{"items": [{"text": "Tan Wei Ming", "type": "name"}, {"text": "Invented", "type": "name"}]}')
    assert llm.detect_pii("Signed by Tan Wei Ming.") == [{"text": "Tan Wei Ming", "type": "name"}]
