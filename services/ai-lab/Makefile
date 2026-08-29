.PHONY: dev test eval lint format

dev:
	uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	uv run pytest tests/ -v

eval:
	@if [ -z "$$(ls -A evals/*.py 2>/dev/null)" ]; then \
		echo "No evals yet — add tests to evals/"; \
	else \
		uv run pytest evals/ -v; \
	fi

lint:
	uv run ruff check .

format:
	uv run ruff format .
