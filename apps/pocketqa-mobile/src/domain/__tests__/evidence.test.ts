import { buildEvidencePayload, proposeFailureRepair } from "../evidence";
import type { ApprovedTest, ReplayResult, UIState } from "../schemas";

const baseTest: ApprovedTest = {
  schemaVersion: "pocketqa/approved-test@1",
  id: "t1",
  version: 1,
  name: "Coupon retry",
  intent: "Verify SAVE20 stays applied after retry.",
  packageName: "com.pocketqa.demoshop",
  compiledBy: "deterministic-local",
  createdAt: 1,
  approvedAt: 2,
  schemaHash: "h",
  offlineOnly: true,
  finalAssertions: [],
  steps: [
    {
      id: "step-1",
      order: 0,
      action: "tap",
      label: "Apply coupon",
      selector: {
        primary: { strategy: "textAndRole", value: "Apply coupon", role: "button", confidence: 0.55, reason: "text match" },
        fallbacks: [
          { strategy: "resourceId", value: "shop:coupon-apply", role: "button", confidence: 0.9, reason: "resource id" },
        ],
        candidateCount: 2,
      },
      beforeStateId: "s1",
      afterStateId: "s2",
      assertions: [],
      needsHumanCorrection: false,
    },
  ],
};

const state: UIState = { id: "s1", packageName: "com.pocketqa.demoshop", screenName: "cart", capturedAt: 1, ocrText: [], nodes: [] };

describe("proposeFailureRepair", () => {
  it("suggests promoting a fallback on selector drift", () => {
    const result: ReplayResult = {
      runId: "r1", testId: "t1", testVersion: 1, startedAt: 0, finishedAt: 1,
      passed: false, offline: true,
      stepResults: [{ stepId: "step-1", status: "fail", elapsedMs: 1, errorCode: "TARGET_NOT_FOUND" }],
      assertionResults: [],
      failure: { category: "selector-drift", summary: "Selector no longer resolves" },
    };
    const p = proposeFailureRepair(baseTest, result);
    expect(p).not.toBeNull();
    expect(p?.action?.kind).toBe("promote-fallback");
    if (p?.action?.kind === "promote-fallback") {
      expect(p.action.strategy).toBe("resourceId");
    }
  });

  it("returns null when the run passed", () => {
    const result: ReplayResult = {
      runId: "r1", testId: "t1", testVersion: 1, startedAt: 0, finishedAt: 1,
      passed: true, offline: true, stepResults: [], assertionResults: [],
    };
    expect(proposeFailureRepair(baseTest, result)).toBeNull();
  });
});

describe("buildEvidencePayload", () => {
  it("packs manifest, test, result and per-state files", () => {
    const result: ReplayResult = {
      runId: "r1", testId: "t1", testVersion: 1, startedAt: 0, finishedAt: 1,
      passed: true, offline: true, stepResults: [], assertionResults: [],
    };
    const payload = buildEvidencePayload({
      test: baseTest,
      result,
      states: { s1: state },
      intent: baseTest.intent,
      device: { model: "test", os: "Android", app: baseTest.packageName, pocketqa: "0" },
      offline: true,
    });
    const paths = payload.files.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["manifest.json", "test.json", "result.json", "maestro.yaml", "states/s1.json"]));
    expect(payload.manifest.integrity.testHash).toBeTruthy();
  });
});
