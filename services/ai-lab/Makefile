.PHONY: install test eval schemas fixtures check

install:
	uv venv --python 3.11 || uv venv
	uv pip install -e '.[dev]'

test:
	.venv/bin/pytest -q

eval:
	.venv/bin/python evals/run_evals.py

# Costs money and needs OPENROUTER_API_KEY. Compares the deterministic twin
# against an on-device-sized model and a ceiling model. Never run in CI.
eval-models:
	.venv/bin/python -u evals/run_evals.py --engine all --concurrency 8

schemas:
	.venv/bin/python -m app.export_schemas

fixtures:
	.venv/bin/python ../../packages/ai-fixtures/build_v0.py

check: schemas test eval
