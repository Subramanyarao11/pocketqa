"""Connected structured-output engine — interim implementation of Track B's
AI-B-02, via OpenRouter.

HANDOFF: see PocketQA_AI_Engine_Handoff.md. This file exists so Track A could get
real model numbers before the service layer landed. It implements the frozen
`StructuredInferenceEngine` protocol and nothing else, so replacing it is a
one-file change.

Two things about it are not throwaway and should survive the rewrite:

  * `app/schema_strict.py` — the Pydantic-to-strict-JSON-Schema transform. Every
    provider with OpenAI-style structured outputs needs it.
  * the result mapping — HTTP reality (429, 5xx, timeouts, truncated JSON) folded
    into the five `InferenceResult` cases the Kotlin gateway also has to produce.

Note on consent: spec 18.2 forbids an automatic local-to-connected fallback. This
engine is never selected implicitly — the caller names it. In the lab that is the
`--engine` flag; on device it is Track B's capability router (AI-B-19) acting on
an explicit, per-operation consent. Constructing this class is not consent, so
`consent` is recorded on every call and defaults to the explicit-grant state only
because reaching this code already required someone to ask for it.
"""

from __future__ import annotations

import json
import os
import random
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import Settings, settings as load_settings
from app.engines.base import (
    ConsentState,
    EngineStatus,
    Failed,
    InferenceProvenance,
    InferenceResult,
    InvalidOutput,
    Success,
    Timeout,
    Unavailable,
)
from app.schema_strict import to_strict
from app.tasks.base import TaskSpec

# Ranking and classification are not creative tasks. Spec 18.3 pins this range.
TEMPERATURE = 0.1
RETRYABLE_STATUS = frozenset({408, 409, 429, 500, 502, 503, 504})


class OpenRouterEngine:
    """One model, one engine instance. The eval harness builds two — the ceiling
    model and the on-device proxy — and scores them side by side."""

    def __init__(
        self,
        model: str | None = None,
        *,
        config: Settings | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self._settings = config or load_settings()
        self.model = model or self._settings.ceiling_model
        self.engine_id = f"openrouter:{self.model}"
        # One client per engine, not one per call: a fresh client per request
        # leaks sockets and defeats connection reuse, which is what made the
        # first full eval run take twenty minutes.
        self._client = client or httpx.Client(
            timeout=httpx.Timeout(
                connect=10.0,
                read=self._settings.timeout_ms / 1000,
                write=10.0,
                pool=10.0,
            ),
            limits=httpx.Limits(max_connections=16, max_keepalive_connections=8),
        )

    # -- protocol ---------------------------------------------------------

    def close(self) -> None:
        self._client.close()

    def status(self) -> EngineStatus:
        return EngineStatus.READY if self._settings.configured else EngineStatus.UNAVAILABLE

    def generate(
        self,
        task: TaskSpec,
        request: Any,
        timeout_ms: int | None = None,
    ) -> InferenceResult[Any]:
        if not self._settings.configured:
            return Unavailable(reason="no API key configured")

        timeout_ms = timeout_ms or self._settings.timeout_ms
        envelope = task.prompt(request)  # evidence is redacted inside prompt()

        # Why two modes exist.
        #
        # `json_schema` with strict:true has the provider enforce the grammar
        # during decoding. It is the stronger guarantee and the right default.
        # But some small models degenerate inside an enforced grammar: measured
        # here, gemma-3-4b spent its entire 4096-token budget emitting runs of
        # whitespace on a response that needs ~150, and was cut off mid-object.
        # The same model, same prompt, same schema, given `json_object` and the
        # schema as text, answered correctly in 3 seconds.
        #
        # So "auto" tries the strong mode and falls back to the weaker one only
        # when the strong one produced unusable output. Nothing is relaxed by
        # this: Pydantic and the merge rule run identically either way, and the
        # mode that answered is recorded in provenance.
        modes = {
            "json_schema": ("json_schema",),
            "json_object": ("json_object",),
        }.get(self._settings.response_mode, ("json_schema", "json_object"))

        last: InferenceResult[Any] = Unavailable(reason="no attempt made")
        for mode in modes:
            last = self._attempt(task, envelope, mode, timeout_ms)
            if not isinstance(last, InvalidOutput):
                return last
        return last

    def _attempt(
        self,
        task: TaskSpec,
        envelope: Any,
        mode: str,
        timeout_ms: int,
    ) -> InferenceResult[Any]:
        strict_schema = to_strict(
            envelope.response_schema, task.response_model.SERVER_ASSERTED
        )
        messages = envelope.to_messages()

        if mode == "json_schema":
            fmt: dict[str, Any] = {
                "type": "json_schema",
                "json_schema": {
                    "name": f"{task.task_id}_response",
                    "strict": True,
                    "schema": strict_schema,
                },
            }
        else:
            fmt = {"type": "json_object"}
            messages[0]["content"] += (
                "\n\nReply with one JSON object and nothing else. It must match "
                "this schema exactly:\n" + json.dumps(strict_schema)
            )

        body = {
            "model": self.model,
            "messages": messages,
            "temperature": TEMPERATURE,
            # Never leave this to the provider. `classify_flake` over 20 runs is
            # our largest response and needs roughly 1,500 tokens; an unset cap
            # let a provider truncate at its own default.
            "max_tokens": self._settings.max_output_tokens,
            "response_format": fmt,
        }

        started = time.monotonic()
        try:
            payload = self._post(body, timeout_ms, started)
        except _Timeout as exc:
            return Timeout(elapsed_ms=exc.elapsed_ms)
        except _Unavailable as exc:
            return Unavailable(reason=exc.reason)
        except Exception:  # noqa: BLE001 - safe codes must not carry captured content
            return Failed(safe_code="CONNECTED_ENGINE_ERROR")

        elapsed_ms = int((time.monotonic() - started) * 1000)
        usage = payload.get("usage") or {}

        try:
            choice = payload["choices"][0]
            content = choice["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return InvalidOutput(issues=["response contained no message content"])

        # Check this BEFORE parsing. A truncated response is valid JSON that
        # simply stops, so `json.loads` reports a delimiter error and the failure
        # reads as though the model produced nonsense. It did not: it ran out of
        # room. Saying so is the difference between "tune the prompt" and "raise
        # the cap", and the first diagnosis cost six hundred seconds.
        if choice.get("finish_reason") == "length":
            return InvalidOutput(
                issues=[
                    f"[{mode}] response truncated: the model hit the output token "
                    f"limit ({self._settings.max_output_tokens}). Raise "
                    "POCKETQA_MAX_OUTPUT_TOKENS or reduce the response size.",
                    *_raw_hint(content),
                ]
            )

        try:
            parsed = json.loads(_unfence(content))
        except json.JSONDecodeError as exc:
            return InvalidOutput(
                issues=[f"[{mode}] content was not valid JSON: {exc.msg}", *_raw_hint(content)]
            )

        try:
            value = task.parse_response(parsed)
        except Exception as exc:  # noqa: BLE001
            return InvalidOutput(
                issues=[f"[{mode}] response failed schema validation: {exc}", *_raw_hint(content)]
            )

        return Success(
            value=value,
            provenance=InferenceProvenance(
                engine_id=self.engine_id,
                model=payload.get("model") or self.model,
                prompt_version=f"{task.task_id}@{envelope.prompt_version}",
                latency_ms=elapsed_ms,
                input_tokens=usage.get("prompt_tokens"),
                output_tokens=usage.get("completion_tokens"),
                redaction_applied=True,
                consent=ConsentState.OPERATION_LEVEL_GRANTED,
                network_used=True,
                response_mode=mode,
            ),
        )

    # -- transport --------------------------------------------------------

    def _request_within(
        self,
        url: str,
        headers: dict[str, str],
        body: dict[str, Any],
        started: float,
        timeout_ms: int,
    ) -> _Response:
        """POST with a real total deadline.

        `httpx`'s read timeout is per-read, not per-request, so a model that
        drips one token every few seconds keeps the connection alive forever and
        no timeout fires. That is not theoretical: a single gemma-3-4b call ran
        past six minutes here against a 30-second read timeout.

        Streaming the body lets us check the elapsed budget on every chunk, and
        leaving the context manager closes the connection, so abandoning a slow
        response actually abandons it. On device this is not optional — spec 18.3
        mandates a 15-second cap and a per-read timeout cannot deliver one.
        """
        with self._client.stream("POST", url, headers=headers, json=body) as response:
            if response.status_code != 200:
                response.read()
                return _Response(response.status_code, b"")

            chunks: list[bytes] = []
            for chunk in response.iter_bytes():
                if (time.monotonic() - started) * 1000 > timeout_ms:
                    raise _Timeout(int((time.monotonic() - started) * 1000))
                chunks.append(chunk)
            return _Response(200, b"".join(chunks))

    def _post(self, body: dict[str, Any], timeout_ms: int, started: float) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._settings.api_key}",
            "Content-Type": "application/json",
            # OpenRouter attribution headers; harmless elsewhere.
            "HTTP-Referer": "https://github.com/pocketqa",
            "X-Title": "PocketQA AI lab",
        }
        url = f"{self._settings.base_url}/chat/completions"
        last_status: int | None = None

        for attempt in range(self._settings.max_retries):
            try:
                response = self._request_within(url, headers, body, started, timeout_ms)
            except httpx.TimeoutException:
                raise _Timeout(int((time.monotonic() - started) * 1000)) from None

            if response.status_code == 200:
                return json.loads(response.content)

            last_status = response.status_code
            if response.status_code not in RETRYABLE_STATUS:
                # 400/401/404 will not improve on a retry. Surfacing the status
                # without the body keeps provider error text - which can echo the
                # prompt back - out of our logs.
                raise _Unavailable(f"provider returned HTTP {response.status_code}")

            # Exponential backoff with jitter. Jitter matters: the eval harness
            # fires the whole suite at once and would otherwise retry in lockstep.
            backoff = min(2 ** attempt, 8) + random.uniform(0, 0.5)
            time.sleep(backoff)

        raise _Unavailable(f"provider unavailable after {self._settings.max_retries} attempts "
                           f"(last HTTP {last_status})")


@dataclass(frozen=True, slots=True)
class _Response:
    status_code: int
    content: bytes


class _Timeout(Exception):
    def __init__(self, elapsed_ms: int) -> None:
        self.elapsed_ms = elapsed_ms


class _Unavailable(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason


def _raw_hint(content: str) -> list[str]:
    """A truncated look at the raw response, for debugging only.

    Off by default. Model output is written over evidence that has already been
    redacted, but it is still captured content and section 34 treats log strings
    as an exfiltration path, so this is opt-in via POCKETQA_DEBUG_RAW=1 and never
    on in a shared environment.
    """
    if os.environ.get("POCKETQA_DEBUG_RAW") != "1":
        return []
    snippet = content.strip().replace("\n", " ")[:400]
    return [f"raw (debug, truncated): {snippet}"]


def _unfence(content: str) -> str:
    """Strip a ```json fence if the model added one despite structured outputs.

    Small models do this often enough that failing on it would misreport a
    formatting quirk as a reasoning failure, which is exactly the confusion the
    device-proxy comparison exists to avoid.
    """
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()
