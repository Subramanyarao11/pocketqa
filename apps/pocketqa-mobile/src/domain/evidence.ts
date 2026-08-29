import type { ApprovedTest, FailureCategory, ReplayResult, TestStep, UIState } from "./schemas";
import { toMaestroYaml } from "./maestro";
import { djb2 } from "./ids";

/**
 * Failure Detective — PRD §7.11 / FR-EVD-002.
 *
 * Given a failed replay, produce a plain-English repair suggestion the reviewer
 * can act on.  Suggestions are conservative: propose, never patch silently.
 */
export interface FailureProposalDomain {
  runId: string;
  stepId?: string;
  category: FailureCategory;
  summary: string;
  suggestion: string;
  action?:
    | { kind: "promote-fallback"; strategy: string; value: string }
    | { kind: "add-wait"; ms: number }
    | { kind: "update-fixture"; fixture: string }
    | { kind: "review-assertion"; assertionTarget: string };
}

export function proposeFailureRepair(
  test: ApprovedTest,
  result: ReplayResult
): FailureProposalDomain | null {
  if (!result.failure || result.passed) return null;
  const { failure } = result;
  const failingStepResult = result.stepResults.find((s) => s.status === "fail");
  const failingStep: TestStep | undefined = failingStepResult
    ? test.steps.find((s) => s.id === failingStepResult.stepId)
    : undefined;

  switch (failure.category) {
    case "selector-drift": {
      const fallback = failingStep?.selector?.fallbacks[0];
      if (fallback) {
        return {
          runId: result.runId,
          stepId: failingStep?.id,
          category: failure.category,
          summary: failure.summary,
          suggestion: `Promote fallback selector "${fallback.strategy}=${fallback.value}" (${(fallback.confidence * 100).toFixed(0)}% confidence).`,
          action: { kind: "promote-fallback", strategy: fallback.strategy, value: fallback.value },
        };
      }
      return {
        runId: result.runId,
        stepId: failingStep?.id,
        category: failure.category,
        summary: failure.summary,
        suggestion: "Re-record this step — no stable fallback selector is available.",
      };
    }
    case "assertion-regression": {
      const failed = result.assertionResults.find((a) => a.status === "fail");
      return {
        runId: result.runId,
        stepId: failingStep?.id,
        category: failure.category,
        summary: failure.summary,
        suggestion: failed
          ? `Verify the expected value "${failed.expected}" still matches the intent, or update the assertion.`
          : "Review the failing assertion — the observed state no longer matches expectation.",
        action: failed ? { kind: "review-assertion", assertionTarget: failed.expected ?? "" } : undefined,
      };
    }
    case "timeout-performance":
      return {
        runId: result.runId,
        stepId: failingStep?.id,
        category: failure.category,
        summary: failure.summary,
        suggestion: "Add a short wait before this step or increase the idle timeout.",
        action: { kind: "add-wait", ms: 500 },
      };
    case "environment-fixture":
      return {
        runId: result.runId,
        stepId: failingStep?.id,
        category: failure.category,
        summary: failure.summary,
        suggestion: "Reset to a known fixture before replay.",
        action: { kind: "update-fixture", fixture: "reset" },
      };
    case "policy-hard-stop":
      return {
        runId: result.runId,
        stepId: failingStep?.id,
        category: failure.category,
        summary: failure.summary,
        suggestion: "Policy blocked this action. Re-record so the step lands inside the allowlist.",
      };
    case "navigation-divergence":
      return {
        runId: result.runId,
        stepId: failingStep?.id,
        category: failure.category,
        summary: failure.summary,
        suggestion: "The screen diverged from what was captured. Re-record from the failing step.",
      };
    case "target-app-crash":
    case "permission-capture":
    case "unknown":
    default:
      return {
        runId: result.runId,
        stepId: failingStep?.id,
        category: failure.category,
        summary: failure.summary,
        suggestion: "Open the evidence trail to inspect the failing state before repairing.",
      };
  }
}

/**
 * Serialize an evidence bundle to a plain payload.  The React Native façade
 * hands this to the native side (`PocketQaNative.exportEvidence`) which is
 * responsible for writing it to app-private storage and returning a
 * shareable `content://` URI.  Nothing here touches the DOM/Blob API.
 */

export interface EvidenceInput {
  test: ApprovedTest;
  result: ReplayResult;
  states: Record<string, UIState>;
  intent: string;
  device: { model: string; os: string; app: string; pocketqa: string };
  offline: boolean;
}

export interface EvidencePayload {
  files: Array<{ path: string; content: string; contentType: "json" | "yaml" | "text" }>;
  manifest: EvidenceManifest;
}

export interface EvidenceManifest {
  schemaVersion: "pocketqa/evidence@1";
  generatedAt: string;
  intent: string;
  testId: string;
  testVersion: number;
  device: EvidenceInput["device"];
  executionPolicy: {
    allowlist: string[];
    offline: boolean;
    connectedProvider: string | null;
  };
  result: {
    passed: boolean;
    failure: NonNullable<ReplayResult["failure"]> | null;
    steps: number;
    assertions: number;
  };
  integrity: {
    testHash: string;
    resultHash: string;
  };
  notes: string;
}

export function buildEvidencePayload(input: EvidenceInput): EvidencePayload {
  const files: EvidencePayload["files"] = [];
  const testJson = JSON.stringify(input.test, null, 2);
  files.push({ path: "test.json", content: testJson, contentType: "json" });
  files.push({ path: "result.json", content: JSON.stringify(input.result, null, 2), contentType: "json" });
  files.push({ path: "intent.txt", content: input.intent, contentType: "text" });
  files.push({ path: "maestro.yaml", content: toMaestroYaml(input.test), contentType: "yaml" });

  const referenced = new Set<string>();
  for (const step of input.test.steps) {
    referenced.add(step.beforeStateId);
    referenced.add(step.afterStateId);
  }
  for (const stepRes of input.result.stepResults) {
    if (stepRes.beforeStateId) referenced.add(stepRes.beforeStateId);
    if (stepRes.afterStateId) referenced.add(stepRes.afterStateId);
  }
  for (const id of referenced) {
    const state = input.states[id];
    if (!state) continue;
    files.push({ path: `states/${id}.json`, content: JSON.stringify(state, null, 2), contentType: "json" });
  }

  const manifest: EvidenceManifest = {
    schemaVersion: "pocketqa/evidence@1",
    generatedAt: new Date().toISOString(),
    intent: input.intent,
    testId: input.test.id,
    testVersion: input.test.version,
    device: input.device,
    executionPolicy: {
      allowlist: [input.test.packageName],
      offline: input.offline,
      connectedProvider: null,
    },
    result: {
      passed: input.result.passed,
      failure: input.result.failure ?? null,
      steps: input.result.stepResults.length,
      assertions: input.result.assertionResults.length,
    },
    integrity: {
      testHash: djb2(testJson),
      resultHash: djb2(JSON.stringify(input.result)),
    },
    notes: "Generated by PocketQA — sensitive fields redacted per policy.",
  };
  files.push({ path: "manifest.json", content: JSON.stringify(manifest, null, 2), contentType: "json" });
  return { files, manifest };
}
