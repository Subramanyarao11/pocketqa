import type {
  ApprovedTest,
  Assertion,
  AssertionResult,
  FailureCategory,
  ReplayResult,
  StepResult,
  UIState,
} from "./schemas";
import { resolveSelector } from "./selectors";
import { ALLOWLISTED_PACKAGES, checkNode, checkPackageBoundary } from "./policy";
import { nextId } from "./ids";

/**
 * Deterministic executor — PRD FR-RUN-001..005.
 *
 * The `harness` is a pluggable driver: in the mobile build it wraps the
 * Kotlin AccessibilityService; in the web prototype it drives the embedded
 * Demo Shop.  Same contract either way.
 */
export interface ReplayHarness {
  activePackageName(): string;
  currentState(): UIState;
  performTap(nodeId: string): Promise<void>;
  performTypeText(nodeId: string, value: string): Promise<void>;
  performBack(): Promise<void>;
  performLaunch(packageName: string): Promise<void>;
  waitForIdle(ms: number): Promise<void>;
  resetFixture(): Promise<void>;
}

export interface ReplayHooks {
  onStep?: (index: number, message: string, level: "info" | "pass" | "fail") => void;
  offline?: boolean;
  stopSignal?: { stopped: boolean };
}

export async function replayApprovedTest(
  test: ApprovedTest,
  harness: ReplayHarness,
  hooks: ReplayHooks = {}
): Promise<ReplayResult> {
  const startedAt = Date.now();
  const stepResults: StepResult[] = [];
  const assertionResults: AssertionResult[] = [];
  let failure: ReplayResult["failure"] | undefined;

  const log = (idx: number, msg: string, level: "info" | "pass" | "fail" = "info") =>
    hooks.onStep?.(idx, msg, level);

  log(-1, `Resetting fixture for ${test.packageName}…`);
  await harness.resetFixture();
  await harness.performLaunch(test.packageName);
  await harness.waitForIdle(120);

  for (const step of test.steps) {
    const stepStart = Date.now();
    if (hooks.stopSignal?.stopped) {
      stepResults.push({
        stepId: step.id,
        status: "skipped",
        reason: "User stop",
        elapsedMs: Date.now() - stepStart,
      });
      failure = {
        category: "policy-hard-stop",
        summary: "User pressed Stop before this step.",
      };
      break;
    }

    // 1) Verify package boundary.
    const pkgDecision = checkPackageBoundary(harness.activePackageName(), ALLOWLISTED_PACKAGES);
    if (!pkgDecision.allowed) {
      failure = { category: "policy-hard-stop", summary: pkgDecision.reason };
      log(step.order, `HARD STOP ${pkgDecision.code}: ${pkgDecision.reason}`, "fail");
      stepResults.push({
        stepId: step.id,
        status: "fail",
        errorCode: pkgDecision.code,
        reason: pkgDecision.reason,
        elapsedMs: Date.now() - stepStart,
      });
      break;
    }

    const state = harness.currentState();

    // 2) Resolve selector (if action needs a target).
    let observedNodeId: string | undefined;
    let usedFallback = false;
    if (step.selector && ["tap", "longPress", "typeText", "clearText"].includes(step.action)) {
      const resolved = resolveSelector(step.selector, state);
      if (!resolved.ok) {
        const category: FailureCategory =
          resolved.code === "TARGET_AMBIGUOUS" ? "selector-drift" : "selector-drift";
        failure = {
          category,
          summary: resolved.message,
          evidenceStateId: state.id,
        };
        log(step.order, `${resolved.code}: ${resolved.message}`, "fail");
        stepResults.push({
          stepId: step.id,
          status: "fail",
          errorCode: resolved.code,
          reason: resolved.message,
          elapsedMs: Date.now() - stepStart,
          beforeStateId: state.id,
        });
        break;
      }
      observedNodeId = resolved.node.nodeId;
      usedFallback = resolved.usedFallback;
      const nodeDecision = checkNode(state, resolved.node);
      if (!nodeDecision.allowed) {
        failure = { category: "policy-hard-stop", summary: nodeDecision.reason };
        log(step.order, `HARD STOP ${nodeDecision.code}: ${nodeDecision.reason}`, "fail");
        stepResults.push({
          stepId: step.id,
          status: "fail",
          errorCode: nodeDecision.code,
          reason: nodeDecision.reason,
          elapsedMs: Date.now() - stepStart,
          beforeStateId: state.id,
        });
        break;
      }
    }

    log(
      step.order,
      `▶ ${step.label}${usedFallback ? " (fallback selector)" : ""}`,
      "info"
    );

    // 3) Perform.
    try {
      switch (step.action) {
        case "tap":
        case "longPress":
          if (observedNodeId) await harness.performTap(observedNodeId);
          break;
        case "typeText":
          if (observedNodeId && step.input !== undefined) {
            await harness.performTypeText(observedNodeId, step.input);
          }
          break;
        case "back":
          await harness.performBack();
          break;
        case "wait":
          await harness.waitForIdle(step.waitMs ?? 300);
          break;
        case "launch":
          await harness.performLaunch(test.packageName);
          break;
        case "clearText":
          if (observedNodeId) await harness.performTypeText(observedNodeId, "");
          break;
        case "scroll":
        case "unknown":
          // Not implemented in the deterministic web harness.
          break;
      }
      await harness.waitForIdle(80);
    } catch (err) {
      failure = {
        category: "target-app-crash",
        summary: err instanceof Error ? err.message : String(err),
      };
      log(step.order, `Executor error: ${failure.summary}`, "fail");
      stepResults.push({
        stepId: step.id,
        status: "fail",
        errorCode: "EXECUTOR_ERROR",
        reason: failure.summary,
        elapsedMs: Date.now() - stepStart,
      });
      break;
    }

    // 4) Evaluate step assertions against post-state.
    const postState = harness.currentState();
    const stepAssertionResults = evaluateAssertions(step.assertions, postState);
    assertionResults.push(...stepAssertionResults);
    const failedAssertion = stepAssertionResults.find((a) => a.status === "fail");
    if (failedAssertion) {
      failure = {
        category: "assertion-regression",
        summary: `Assertion failed: expected "${failedAssertion.expected}".`,
        evidenceStateId: postState.id,
      };
      log(step.order, `✗ ${failure.summary}`, "fail");
      stepResults.push({
        stepId: step.id,
        status: "fail",
        errorCode: "ASSERTION_FAILED",
        reason: failure.summary,
        observedNodeId,
        elapsedMs: Date.now() - stepStart,
        beforeStateId: state.id,
        afterStateId: postState.id,
      });
      break;
    }

    log(step.order, "✓ step passed", "pass");
    stepResults.push({
      stepId: step.id,
      status: "pass",
      observedNodeId,
      elapsedMs: Date.now() - stepStart,
      beforeStateId: state.id,
      afterStateId: postState.id,
    });
  }

  // Final assertions.
  if (!failure) {
    const finalState = harness.currentState();
    const finalResults = evaluateAssertions(test.finalAssertions, finalState);
    assertionResults.push(...finalResults);
    const finalFailed = finalResults.find((a) => a.status === "fail");
    if (finalFailed) {
      failure = {
        category: "assertion-regression",
        summary: `Final assertion failed: expected "${finalFailed.expected}".`,
        evidenceStateId: finalState.id,
      };
      log(test.steps.length, `✗ ${failure.summary}`, "fail");
    } else {
      log(test.steps.length, "✓ all final assertions passed", "pass");
    }
  }

  const passed = !failure;
  return {
    runId: nextId("run"),
    testId: test.id,
    testVersion: test.version,
    startedAt,
    finishedAt: Date.now(),
    passed,
    offline: hooks.offline ?? true,
    stepResults,
    assertionResults,
    failure,
  };
}

function evaluateAssertions(assertions: Assertion[], state: UIState): AssertionResult[] {
  const visible = new Set<string>();
  for (const n of state.nodes) {
    if (n.visible && n.text) visible.add(n.text);
  }
  for (const t of state.ocrText) visible.add(t);
  return assertions.map((a): AssertionResult => {
    switch (a.kind) {
      case "textVisible":
        return {
          assertionId: a.id,
          status: visible.has(a.target) || [...visible].some((v) => v.includes(a.target))
            ? "pass"
            : "fail",
          observed: [...visible].join(" | "),
          expected: a.target,
        };
      case "textAbsent":
        return {
          assertionId: a.id,
          status: !visible.has(a.target) ? "pass" : "fail",
          observed: [...visible].join(" | "),
          expected: a.target,
        };
      case "onScreen":
        return {
          assertionId: a.id,
          status: state.nodes.some((n) => n.nodeId === a.target && n.visible) ? "pass" : "fail",
          expected: a.target,
        };
      default:
        return { assertionId: a.id, status: "pass", expected: a.target };
    }
  });
}
