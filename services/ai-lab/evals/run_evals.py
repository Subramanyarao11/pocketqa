#!/usr/bin/env python3
"""Eval harness — Track A task AI-A-02.

Scores three things separately, because they fail independently and a prompt
change that trades one for another is a regression, not a tuning decision:

  correctness  did the task pick the right answer
  safety       did it stay inside the supplied vocabulary and the schema
  budget       did it answer inside its latency allowance

A prompt that improves correctness while breaking safety does not pass here.

Run: make eval                       (deterministic engine, the default)
     python evals/run_evals.py --engine openai   (once Track B lands AI-B-02)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.engines.base import Success  # noqa: E402
from app.engines.deterministic import DeterministicInferenceEngine  # noqa: E402
from app.engines.openrouter_engine import OpenRouterEngine  # noqa: E402
from app.merge import merge  # noqa: E402
from app.tasks import get  # noqa: E402
from app.tasks.audit_accessibility import AuditState, detect  # noqa: E402

CASES_DIR = Path(__file__).parent / "cases"
FIXTURES = Path(__file__).resolve().parents[3] / "packages" / "ai-fixtures"

# USD per 1M tokens, read from the OpenRouter catalogue. Indicative only: it
# drifts, and it is here so `make eval` can tell you what a run cost, not so we
# can bill anyone.
PRICING: dict[str, tuple[float, float]] = {
    "google/gemini-2.5-flash": (0.30, 2.50),
    "google/gemma-3-4b-it": (0.05, 0.10),
    "google/gemma-3-12b-it": (0.05, 0.15),
    "openai/gpt-5-mini": (0.25, 2.00),
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    rate_in, rate_out = PRICING.get(model, (0.0, 0.0))
    return (input_tokens * rate_in + output_tokens * rate_out) / 1_000_000


@dataclass
class CaseResult:
    case_id: str
    task_id: str
    correctness: list[tuple[str, bool, str]] = field(default_factory=list)
    safety: list[tuple[str, bool, str]] = field(default_factory=list)
    latency_ms: int = 0
    latency_budget_ms: int | None = None
    error: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    input_tokens: int = 0
    output_tokens: int = 0
    rejected: bool = False
    outcome_kind: str = "Success"

    def axis_ok(self, checks: list[tuple[str, bool, str]]) -> bool:
        return all(ok for _, ok, _ in checks)

    @property
    def budget_ok(self) -> bool:
        return self.latency_budget_ms is None or self.latency_ms <= self.latency_budget_ms

    @property
    def ok(self) -> bool:
        return (
            self.error is None
            and self.axis_ok(self.correctness)
            and self.axis_ok(self.safety)
            and self.budget_ok
        )

    def failures(self) -> list[str]:
        out = [f"{name}: {detail}" for name, ok, detail in self.correctness + self.safety if not ok]
        if not self.budget_ok:
            out.append(f"latency: {self.latency_ms}ms over {self.latency_budget_ms}ms budget")
        if self.error:
            out.append(f"error: {self.error}")
        return out


def deep_merge(base: dict, overrides: dict) -> dict:
    out = dict(base)
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def build_request(case: dict) -> dict:
    """Assemble the request payload for a case.

    `state_file` is the accessibility path: deterministic rules run first and
    their findings become the task input, which is exactly how the feature works
    in production. Evaluating the annotation step against hand-written findings
    would test nothing.
    """

    if "state_file" in case:
        state = AuditState.model_validate(json.loads((FIXTURES / case["state_file"]).read_text()))
        findings = detect(state)
        payload = {
            "stateSummary": f"{state.window_title or state.state_id} "
                            f"({len(state.nodes)} nodes)",
            "findings": [f.model_dump(by_alias=True) for f in findings],
            "allowedFindingIds": [f.finding_id for f in findings],
        }
        payload["_detectedRuleIds"] = sorted({f.rule_id for f in findings})
        return payload

    if "request_file" in case:
        payload = json.loads((FIXTURES / case["request_file"]).read_text())
    else:
        payload = dict(case.get("request", {}))
    return deep_merge(payload, case.get("overrides", {}))


def _ranked_ids(response: Any) -> list[str]:
    if response is None:
        return []
    if hasattr(response, "ranked"):
        first = response.ranked
        if first and hasattr(first[0], "candidate_id"):
            return [row.candidate_id for row in first]
        return [row.node_id for row in first]
    if hasattr(response, "selected"):
        return [row.candidate_id for row in response.selected]
    if hasattr(response, "variants"):
        return [f"{v.dimension}:{v.value}" for v in response.variants]
    if hasattr(response, "annotated"):
        return [row.finding_id for row in response.annotated]
    return []


def check_correctness(case: dict, response: Any, request_payload: dict) -> list[tuple[str, bool, str]]:
    expect = case.get("expect", {})
    checks: list[tuple[str, bool, str]] = []
    ordered = _ranked_ids(response) if response is not None else []

    def add(name: str, ok: bool, detail: str = "") -> None:
        checks.append((name, ok, detail))

    if "insufficient_evidence" in expect:
        want = expect["insufficient_evidence"]
        got = bool(getattr(response, "insufficient_evidence", False))
        add("insufficient_evidence", got == want, f"want {want}, got {got}")

    if "top1" in expect:
        got = ordered[0] if ordered else None
        add("top1", got == expect["top1"], f"want {expect['top1']}, got {got}")

    if "choice" in expect:
        got = getattr(response, "choice", None)
        add("choice", got == expect["choice"], f"want {expect['choice']}, got {got}")

    if "selected_ids" in expect:
        add("selected_ids", ordered == expect["selected_ids"],
            f"want {expect['selected_ids']}, got {ordered}")

    if "contains" in expect:
        missing = [i for i in expect["contains"] if i not in ordered]
        add("contains", not missing, f"missing {missing} from {ordered}")

    if "must_not_contain" in expect:
        present = [i for i in expect["must_not_contain"] if i in ordered]
        add("must_not_contain", not present, f"unexpectedly present: {present}")

    for earlier, later in expect.get("ranked_before", []):
        if earlier in ordered and later in ordered:
            ok = ordered.index(earlier) < ordered.index(later)
            add(f"ranked_before[{earlier}<{later}]", ok, f"order was {ordered}")
        else:
            add(f"ranked_before[{earlier}<{later}]", False, f"one id missing from {ordered}")

    if "bottom_ids" in expect:
        tail = set(ordered[-len(expect["bottom_ids"]):]) if ordered else set()
        add("bottom_ids", set(expect["bottom_ids"]) == tail, f"tail was {sorted(tail)}")

    if "rule_ids" in expect:
        got = request_payload.get("_detectedRuleIds", [])
        add("rule_ids", got == expect["rule_ids"], f"want {expect['rule_ids']}, got {got}")

    if "finding_count" in expect:
        got = len(request_payload.get("findings", []))
        add("finding_count", got == expect["finding_count"], f"want {expect['finding_count']}, got {got}")

    if "classified_matches_labels" in expect:
        labels = json.loads((FIXTURES / expect["classified_matches_labels"]).read_text())
        wrong = [
            f"{row.run_id}: want {labels[row.run_id]}, got {row.failure_class}"
            for row in response.classified
            if str(row.failure_class) != labels[row.run_id]
        ]
        add("classified_matches_labels", not wrong, "; ".join(wrong[:4]))

    if "min_group_count" in expect:
        got = len(getattr(response, "groups", []))
        add("min_group_count", got >= expect["min_group_count"], f"got {got}")

    if "cited_subset_of" in expect:
        cited = set(getattr(response, "cited_fact_ids", []))
        allowed = set(expect["cited_subset_of"])
        add("cited_subset_of", cited <= allowed and bool(cited), f"cited {sorted(cited)}")

    if "name_matches_words_in_evidence" in expect:
        # The name_test vocabulary is words, not ids: this is the same closed-
        # vocabulary guarantee, applied to prose.
        from app.relevance import content_tokens
        spec_allowed = expect["name_matches_words_in_evidence"]
        got = content_tokens(getattr(response, "name", "") or "")
        add("name_grounded", bool(got) and got <= set(spec_allowed),
            f"name used {sorted(got - set(spec_allowed))}")

    if "name_nonempty" in expect:
        got = (getattr(response, "name", "") or "").strip()
        add("name_nonempty", bool(got) == expect["name_nonempty"], f"name was {got!r}")

    if "summary_mentions" in expect:
        summary = (
            getattr(response, "summary", None) or getattr(response, "run_summary", "") or ""
        ).lower()
        missing = [t for t in expect["summary_mentions"] if t.lower() not in summary]
        add("summary_mentions", not missing, f"missing {missing}")

    if "severity_of" in expect:
        by_id = {row.finding_id: str(row.severity) for row in getattr(response, "annotated", [])}
        wrong = [f"{k}: want {v}, got {by_id.get(k)}" for k, v in expect["severity_of"].items()
                 if by_id.get(k) != v]
        add("severity_of", not wrong, "; ".join(wrong))

    if not checks:
        add("no_expectations", False, "case declares no expectations")
    return checks


# A network call is three orders of magnitude slower than a rule. Applying the
# deterministic budget to a model engine turns every model case into a latency
# failure and buries the findings that matter.
MODEL_LATENCY_BUDGET_MS = 60_000


def run_case(
    path: Path, engine, results_by_id: dict[str, Any], *, is_model: bool = False
) -> CaseResult:
    case = yaml.safe_load(path.read_text())
    case_id = case.get("id", path.stem)
    task_id = case["task"]
    result = CaseResult(case_id=case_id, task_id=task_id)

    try:
        spec = get(task_id)
        payload = build_request(case)
        result.payload = payload

        # A clean screen produces no findings, and "no findings" is precisely the
        # result worth asserting. There is nothing to send to an engine, and the
        # task request schema correctly refuses an empty findings list.
        if payload.get("_detectedRuleIds") is not None and not payload.get("findings"):
            result.safety.append(("schema_valid", True, "no findings to annotate"))
            result.safety.append(("in_vocabulary", True, ""))
            result.correctness = check_correctness(case, None, payload)
            return result

        request = spec.parse_request({k: v for k, v in payload.items() if not k.startswith("_")})
    except Exception as exc:  # noqa: BLE001
        result.error = f"{type(exc).__name__}: {exc}"
        return result

    started = time.perf_counter()
    outcome = engine.generate(spec, request)
    result.latency_ms = int((time.perf_counter() - started) * 1000)
    expect = case.get("expect", {})
    result.latency_budget_ms = (
        expect.get("max_model_latency_ms", MODEL_LATENCY_BUDGET_MS)
        if is_model
        else expect.get("max_latency_ms")
    )

    result.outcome_kind = type(outcome).__name__
    if not isinstance(outcome, Success):
        # Unavailable / InvalidOutput / Timeout / Failed are real engine
        # behaviour, not harness errors. The product falls back to the
        # deterministic twin here, and the comparison should say so plainly.
        result.error = f"engine returned {type(outcome).__name__}"
        return result

    result.input_tokens = outcome.provenance.input_tokens or 0
    result.output_tokens = outcome.provenance.output_tokens or 0
    response = outcome.value

    # Safety axis. Runs on every case regardless of what the case asserts: the
    # response must survive its own schema round-trip and must not reference an
    # identifier we never supplied.
    try:
        spec.parse_response(json.loads(response.model_dump_json(by_alias=True)))
        result.safety.append(("schema_valid", True, ""))
    except Exception as exc:  # noqa: BLE001
        result.safety.append(("schema_valid", False, str(exc)))

    outcome_merge = merge(spec, request, response)
    result.rejected = outcome_merge.rejected
    result.safety.append(
        ("in_vocabulary", not outcome_merge.rejected, outcome_merge.rejection_reason or "")
    )

    result.correctness = check_correctness(case, response, payload)

    # Reproducibility / injection resistance: identical to a named baseline case.
    if "same_as" in case:
        baseline = results_by_id.get(case["same_as"])
        if baseline is None:
            result.correctness.append(("same_as", False, f"baseline {case['same_as']} not run yet"))
        else:
            got = _ranked_ids(response)
            want = _ranked_ids(baseline)
            # The injected candidate itself is expected to be present but must not
            # displace anything: compare the baseline ids in their baseline order.
            filtered = [i for i in got if i in set(want)]
            result.correctness.append(
                ("same_as", filtered == want, f"baseline {want}, got {filtered}")
            )

    results_by_id[case_id] = response
    return result


def build_engines(names: list[str]) -> list[tuple[str, Any, str | None]]:
    """(label, engine, model) for each requested engine."""
    cfg = settings()
    built: list[tuple[str, Any, str | None]] = []
    for name in names:
        if name == "deterministic":
            built.append(("rules", DeterministicInferenceEngine(), None))
        elif name == "device":
            built.append(("device-proxy", OpenRouterEngine(cfg.device_proxy_model),
                          cfg.device_proxy_model))
        elif name == "ceiling":
            built.append(("ceiling", OpenRouterEngine(cfg.ceiling_model), cfg.ceiling_model))
    return built


def run_suite(
    engine,
    paths: list[Path],
    task_filter: str | None,
    *,
    concurrency: int = 1,
    progress: bool = False,
    is_model: bool = False,
) -> list[CaseResult]:
    selected: list[tuple[Path, dict]] = []
    for path in paths:
        case = yaml.safe_load(path.read_text())
        if task_filter and case.get("task") != task_filter:
            continue
        selected.append((path, case))

    results_by_id: dict[str, Any] = {}

    if concurrency <= 1:
        results = []
        for path, _case in selected:
            results.append(run_case(path, engine, results_by_id, is_model=is_model))
            if progress:
                print(".", end="", flush=True)
        return results

    # `same_as` cases compare against a baseline case's result, so anything named
    # as a baseline has to finish first. Everything else is independent.
    baselines = {c.get("same_as") for _p, c in selected if c.get("same_as")}
    first = [(p, c) for p, c in selected if c.get("id", p.stem) in baselines]
    rest = [(p, c) for p, c in selected if c.get("id", p.stem) not in baselines]

    ordered: list[CaseResult] = []
    for path, _case in first:
        ordered.append(run_case(path, engine, results_by_id, is_model=is_model))
        if progress:
            print(".", end="", flush=True)

    def run_one(item: tuple[Path, dict]) -> CaseResult:
        result = run_case(item[0], engine, results_by_id, is_model=is_model)
        if progress:
            print(".", end="", flush=True)
        return result

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        ordered.extend(pool.map(run_one, rest))

    order = {p.stem: i for i, (p, _c) in enumerate(selected)}
    ordered.sort(key=lambda r: order.get(r.case_id, 0))
    return ordered


def print_suite(label: str, results: list[CaseResult], model: str | None) -> None:
    by_task: dict[str, list[CaseResult]] = {}
    for r in results:
        by_task.setdefault(r.task_id, []).append(r)

    print(f"\n  engine: {label}" + (f"  ({model})" if model else ""))
    for task_id in sorted(by_task):
        rows = by_task[task_id]
        passed = sum(1 for r in rows if r.ok)
        print(f"    {task_id:26} {passed}/{len(rows)}")
        for r in rows:
            if not r.ok:
                print(f"        FAIL {r.case_id}")
                for line in r.failures():
                    print(f"             {line}")


def summarise(label: str, results: list[CaseResult], model: str | None) -> dict[str, Any]:
    total = len(results)
    return {
        "label": label,
        "model": model,
        "total": total,
        "correct": sum(1 for r in results if r.ok),
        "safe": sum(1 for r in results if r.axis_ok(r.safety)),
        "rejected": sum(1 for r in results if r.rejected),
        "engine_failures": sum(1 for r in results if r.outcome_kind != "Success"),
        "input_tokens": sum(r.input_tokens for r in results),
        "output_tokens": sum(r.output_tokens for r in results),
        "slowest_ms": max((r.latency_ms for r in results), default=0),
        "cost": estimate_cost(
            model or "", sum(r.input_tokens for r in results),
            sum(r.output_tokens for r in results),
        ) if model else 0.0,
    }


def print_comparison(rows: list[dict[str, Any]]) -> None:
    print("\n" + "=" * 78)
    print("  Comparison — correctness is measured against expectations written for")
    print("  the deterministic twin, so a model that disagrees is not automatically")
    print("  wrong. Read `rejected` and `engine fail` first: those are safety.")
    print("=" * 78)
    header = f"  {'engine':14} {'correct':>9} {'in-vocab':>9} {'rejected':>9} {'eng fail':>9} {'slowest':>9} {'cost':>9}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for row in rows:
        cost = f"${row['cost']:.4f}" if row["model"] else "free"
        print(
            f"  {row['label']:14} {row['correct']:>4}/{row['total']:<4} "
            f"{row['safe']:>4}/{row['total']:<4} {row['rejected']:>9} "
            f"{row['engine_failures']:>9} {str(row['slowest_ms']) + 'ms':>9} {cost:>9}"
        )
    total_cost = sum(r["cost"] for r in rows)
    if total_cost:
        print(f"\n  run cost: ${total_cost:.4f}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run PocketQA AI evals.")
    parser.add_argument(
        "--engine", default="deterministic",
        choices=["deterministic", "device", "ceiling", "all"],
        help="'all' runs every engine and prints a comparison. The exit code is "
             "always decided by the deterministic run: models are measured, not gated.",
    )
    parser.add_argument("--task", help="run only cases for this task id")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument(
        "--concurrency", type=int, default=8,
        help="parallel model calls. Ignored for the deterministic engine.",
    )
    args = parser.parse_args()

    names = ["deterministic", "device", "ceiling"] if args.engine == "all" else [args.engine]
    if any(n in ("device", "ceiling") for n in names) and not settings().configured:
        print("no API key configured — add OPENROUTER_API_KEY to services/ai-lab/.env",
              file=sys.stderr)
        return 2

    paths = sorted(CASES_DIR.glob("*.yaml"))
    if not paths:
        print("no eval cases found", file=sys.stderr)
        return 1

    print(f"\nPocketQA AI evals — {len(paths)} cases")
    summaries: list[dict[str, Any]] = []
    gate_ok = True
    payloads: dict[str, list[dict[str, Any]]] = {}

    for label, engine, model in build_engines(names):
        concurrency = 1 if model is None else max(1, args.concurrency)
        if not args.json and model is not None:
            print(f"\n  running {label} ({model}) ", end="", flush=True)
        results = run_suite(
            engine, paths, args.task,
            concurrency=concurrency, progress=not args.json and model is not None,
            is_model=model is not None,
        )
        if not args.json and model is not None:
            print(flush=True)
        if not args.json:
            print_suite(label, results, model)
        summaries.append(summarise(label, results, model))
        payloads[label] = [
            {"id": r.case_id, "task": r.task_id, "ok": r.ok, "rejected": r.rejected,
             "outcome": r.outcome_kind, "latencyMs": r.latency_ms, "failures": r.failures()}
            for r in results
        ]
        if label == "rules":
            gate_ok = all(r.ok for r in results)
            if any(not r.axis_ok(r.safety) for r in results):
                print("\n  SAFETY REGRESSION — do not merge.\n", file=sys.stderr)
                gate_ok = False

    if args.json:
        print(json.dumps({"summaries": summaries, "cases": payloads}, indent=2))
    elif len(summaries) > 1:
        print_comparison(summaries)
    else:
        row = summaries[0]
        print(f"\n  correctness  {row['correct']}/{row['total']} cases")
        print(f"  safety       {row['safe']}/{row['total']} cases in vocabulary and schema-valid")
        print(f"  budget       slowest case {row['slowest_ms']}ms")
        if row["model"]:
            print(f"  cost         ${row['cost']:.4f}\n")
        else:
            print()

    return 0 if gate_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
