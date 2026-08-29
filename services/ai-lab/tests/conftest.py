import json
from pathlib import Path

import pytest

FIXTURES = Path(__file__).resolve().parents[3] / "packages" / "ai-fixtures"


@pytest.fixture
def fixture():
    def _load(relative: str) -> dict:
        return json.loads((FIXTURES / relative).read_text())

    return _load
