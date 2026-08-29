"""Runtime configuration.

Reads `services/ai-lab/.env` with no external dependency: this file is imported
by the eval harness and by tests, and a dotenv package is not worth a dependency
for eight lines of parsing.

Nothing here ever logs a key. `describe()` exists so that `--verbose` and the
future /health route can report configuration without leaking it.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

# Chosen deliberately (see PocketQA_AI_Engine_Handoff.md):
#   ceiling      - what the task can achieve at all
#   device proxy - Gemma 3 4B is the family LiteRT/MediaPipe deploys on-device,
#                  so a prompt that fails here will not survive the port either
DEFAULT_CEILING_MODEL = "google/gemini-2.5-flash"
DEFAULT_DEVICE_PROXY_MODEL = "google/gemma-3-4b-it"

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def _load_env_file() -> None:
    if not ENV_PATH.exists():
        return
    for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()


@dataclass(frozen=True, slots=True)
class Settings:
    api_key: str | None
    ceiling_model: str
    device_proxy_model: str
    base_url: str
    timeout_ms: int
    max_retries: int
    max_output_tokens: int
    response_mode: str
    env: str
    log_level: str

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def describe(self) -> dict[str, object]:
        """Safe to print, log and serve. Never includes the key itself."""
        return {
            "apiKeyPresent": self.configured,
            "ceilingModel": self.ceiling_model,
            "deviceProxyModel": self.device_proxy_model,
            "baseUrl": self.base_url,
            "timeoutMs": self.timeout_ms,
            "maxRetries": self.max_retries,
            "maxOutputTokens": self.max_output_tokens,
            "responseMode": self.response_mode,
            "env": self.env,
        }


def settings() -> Settings:
    return Settings(
        api_key=os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY"),
        ceiling_model=os.environ.get("POCKETQA_LLM_MODEL") or DEFAULT_CEILING_MODEL,
        device_proxy_model=(
            os.environ.get("POCKETQA_DEVICE_PROXY_MODEL") or DEFAULT_DEVICE_PROXY_MODEL
        ),
        base_url=os.environ.get("POCKETQA_BASE_URL") or OPENROUTER_BASE_URL,
        timeout_ms=int(os.environ.get("POCKETQA_TIMEOUT_MS") or 30_000),
        max_retries=int(os.environ.get("POCKETQA_MAX_RETRIES") or 3),
        # Sent explicitly on every request. Leaving it unset means the provider
        # picks, and a provider default that is too small truncates the JSON
        # mid-object — which arrives looking exactly like a reasoning failure.
        max_output_tokens=int(os.environ.get("POCKETQA_MAX_OUTPUT_TOKENS") or 4096),
        # auto | json_schema | json_object. See OpenRouterEngine for why "auto"
        # is the right default: provider-enforced grammars are stricter but some
        # small models degenerate inside them.
        response_mode=os.environ.get("POCKETQA_RESPONSE_MODE") or "auto",
        env=os.environ.get("POCKETQA_ENV") or "local",
        log_level=os.environ.get("POCKETQA_LOG_LEVEL") or "INFO",
    )
