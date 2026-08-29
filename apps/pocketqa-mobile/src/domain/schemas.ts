import { z } from "zod";

/**
 * Canonical PocketQA schemas.
 *
 * These types are the contract between the capture pipeline, the compiler,
 * the review UI, the deterministic executor, and the export layer.  See
 * PRD §7 (terminology) and §11.4 (compilation).
 */

export const ActionKind = z.enum([
  "tap",
  "longPress",
  "typeText",
  "clearText",
  "back",
  "scroll",
  "wait",
  "launch",
  "unknown",
]);
export type ActionKind = z.infer<typeof ActionKind>;

export const SelectorStrategy = z.enum([
  "testId",
  "resourceId",
  "accessibilityLabel",
  "textAndRole",
  "roleAndRelation",
  "relativePosition",
  "coordinates",
]);
export type SelectorStrategy = z.infer<typeof SelectorStrategy>;

export const Selector = z.object({
  strategy: SelectorStrategy,
  value: z.string(),
  role: z.string().optional(),
  ancestor: z.string().optional(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});
export type Selector = z.infer<typeof Selector>;

export const RankedSelector = z.object({
  primary: Selector,
  fallbacks: z.array(Selector).max(2),
  candidateCount: z.number().int().nonnegative(),
});
export type RankedSelector = z.infer<typeof RankedSelector>;

export const AssertionKind = z.enum([
  "textVisible",
  "textAbsent",
  "elementEnabled",
  "elementDisabled",
  "onScreen",
  "elementCount",
]);
export type AssertionKind = z.infer<typeof AssertionKind>;

export const Assertion = z.object({
  id: z.string(),
  kind: AssertionKind,
  target: z.string(),
  expected: z.string().optional(),
  sourceStateId: z.string(),
  supported: z.boolean(),
  reason: z.string(),
});
export type Assertion = z.infer<typeof Assertion>;

export const TestStep = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
  action: ActionKind,
  label: z.string(),
  selector: RankedSelector.optional(),
  input: z.string().optional(),
  waitMs: z.number().int().nonnegative().optional(),
  beforeStateId: z.string(),
  afterStateId: z.string(),
  assertions: z.array(Assertion).default([]),
  needsHumanCorrection: z.boolean().default(false),
  /** How the step's target was determined — CAP-07. `event` means the platform
   *  reported the interaction; `inferred` means it was deduced from the state
   *  change, which is the normal path on a Compose target. */
  attribution: z
    .object({
      method: z.enum(["event", "inferred"]),
      confidence: z.number(),
      signals: z.array(z.string()).default([]),
      alternatives: z.array(z.string()).default([]),
    })
    .optional(),
});
export type TestStep = z.infer<typeof TestStep>;

export const CapturedNode = z.object({
  nodeId: z.string(),
  role: z.string(),
  text: z.string().optional(),
  contentDescription: z.string().optional(),
  resourceId: z.string().optional(),
  testId: z.string().optional(),
  enabled: z.boolean().default(true),
  visible: z.boolean().default(true),
  bounds: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .optional(),
  sensitive: z.boolean().default(false),
});
export type CapturedNode = z.infer<typeof CapturedNode>;

export const UIState = z.object({
  id: z.string(),
  packageName: z.string(),
  screenName: z.string(),
  capturedAt: z.number(),
  screenshotDataUri: z.string().optional(),
  ocrText: z.array(z.string()).default([]),
  nodes: z.array(CapturedNode),
});
export type UIState = z.infer<typeof UIState>;

export const CaptureEvent = z.object({
  id: z.string(),
  at: z.number(),
  action: ActionKind,
  nodeId: z.string().optional(),
  input: z.string().optional(),
  beforeStateId: z.string(),
  afterStateId: z.string(),
});
export type CaptureEvent = z.infer<typeof CaptureEvent>;

export const CompilerEngine = z.enum([
  "on-device-ai",
  "deterministic-local",
  "connected-assist",
]);
export type CompilerEngine = z.infer<typeof CompilerEngine>;

export const TestDraft = z.object({
  schemaVersion: z.literal("pocketqa/test-draft@1"),
  id: z.string(),
  name: z.string().min(1),
  intent: z.string().min(10),
  packageName: z.string(),
  fixture: z.string().optional(),
  compiledBy: CompilerEngine,
  createdAt: z.number(),
  steps: z.array(TestStep).min(1),
  finalAssertions: z.array(Assertion).default([]),
  offlineOnly: z.boolean().default(true),
});
export type TestDraft = z.infer<typeof TestDraft>;

export const ApprovedTest = TestDraft.extend({
  schemaVersion: z.literal("pocketqa/approved-test@1"),
  version: z.number().int().positive(),
  approvedAt: z.number(),
  schemaHash: z.string(),
});
export type ApprovedTest = z.infer<typeof ApprovedTest>;

export const StepResult = z.object({
  stepId: z.string(),
  status: z.enum(["pass", "fail", "skipped"]),
  reason: z.string().optional(),
  errorCode: z.string().optional(),
  observedNodeId: z.string().optional(),
  elapsedMs: z.number(),
  beforeStateId: z.string().optional(),
  afterStateId: z.string().optional(),
});
export type StepResult = z.infer<typeof StepResult>;

export const AssertionResult = z.object({
  assertionId: z.string(),
  status: z.enum(["pass", "fail"]),
  observed: z.string().optional(),
  expected: z.string().optional(),
});
export type AssertionResult = z.infer<typeof AssertionResult>;

export const FailureCategory = z.enum([
  "selector-drift",
  "assertion-regression",
  "navigation-divergence",
  "timeout-performance",
  "target-app-crash",
  "environment-fixture",
  "permission-capture",
  "policy-hard-stop",
  "unknown",
]);
export type FailureCategory = z.infer<typeof FailureCategory>;

export const ReplayResult = z.object({
  runId: z.string(),
  testId: z.string(),
  testVersion: z.number().int().positive(),
  startedAt: z.number(),
  finishedAt: z.number(),
  passed: z.boolean(),
  offline: z.boolean(),
  stepResults: z.array(StepResult),
  assertionResults: z.array(AssertionResult),
  failure: z
    .object({
      category: FailureCategory,
      summary: z.string(),
      evidenceStateId: z.string().optional(),
    })
    .optional(),
});
export type ReplayResult = z.infer<typeof ReplayResult>;

/**
 * Explorer / Agent Lab schemas — bounded mission with proposals only.
 */
export const MissionTool = z.enum([
  "observe",
  "tapNode",
  "back",
  "waitForIdle",
  "stop",
]);
export type MissionTool = z.infer<typeof MissionTool>;

export const Mission = z.object({
  id: z.string(),
  goal: z.string().min(5),
  packageAllowlist: z.array(z.string()).min(1),
  maxActions: z.number().int().positive().max(5),
  maxDurationSeconds: z.number().int().positive().max(90),
  allowedTools: z.array(MissionTool).min(1),
  hardStops: z.array(z.string()).default([]),
});
export type Mission = z.infer<typeof Mission>;

export const MissionEventKind = z.enum([
  "plan",
  "observe",
  "action",
  "policy-block",
  "stop",
  "propose",
]);
export type MissionEventKind = z.infer<typeof MissionEventKind>;

export const MissionEvent = z.object({
  at: z.number(),
  kind: MissionEventKind,
  message: z.string(),
  meta: z.record(z.string(), z.string()).optional(),
});
export type MissionEvent = z.infer<typeof MissionEvent>;
