"""Shared pytest fixture for Person B's tests: fresh made-up samples in a temp folder."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests import b_samples


@pytest.fixture(scope="session")
def samples(tmp_path_factory):
    d = tmp_path_factory.mktemp("b_samples")
    paths = {k: Path(v) for k, v in b_samples.make(d).items()}
    paths["truth"] = json.loads((d / "b_planted.json").read_text())
    paths["out"] = tmp_path_factory.mktemp("b_out")
    return paths
