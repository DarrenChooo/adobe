"""Shared test helpers: a client for the real app and an upload helper."""
import os
import tempfile
from pathlib import Path

# Tests write to a throwaway storage folder, never the real storage/.
os.environ["FILLME_STORAGE"] = tempfile.mkdtemp(prefix="fillme-test-")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

SAMPLES = Path(__file__).resolve().parents[1] / "samples"


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture
def upload(client):
    def _upload(name: str | Path, data: bytes | None = None) -> str:
        p = SAMPLES / name if isinstance(name, str) else name
        body = data if data is not None else p.read_bytes()
        r = client.post("/api/files", files={"file": (Path(p).name, body)})
        assert r.status_code == 200, r.text
        return r.json()["file_id"]

    return _upload


@pytest.fixture
def run(client):
    def _run(tool_id: str, file_ids: list[str], params: dict | None = None) -> dict:
        r = client.post(f"/api/tools/{tool_id}", json={"file_ids": file_ids, "params": params or {}})
        assert r.status_code == 200, r.text
        return r.json()

    return _run


@pytest.fixture
def fetch(client):
    def _fetch(file_id: str) -> bytes:
        r = client.get(f"/api/files/{file_id}")
        assert r.status_code == 200
        return r.content

    return _fetch
