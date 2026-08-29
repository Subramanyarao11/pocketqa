import type {
  Assertion,
  CaptureEvent,
  CompilerEngine,
  TestDraft,
  TestStep,
  UIState,
} from "./schemas";
import { TestDraft as TestDraftSchema } from "./schemas";
import { rankSelectorsForNode } from "./selectors";
import { nextId } from "./ids";

/**
 * Deterministic local compiler — PRD FR-COM-001 / FR-COM-004.
 *
 * Consumes normalized capture events + the state library and produces a
 * schema-valid TestDraft.  No network, no model.
 */

export interface CompileInput {
  intent: string;
  packageName: string;
  states: Record<string, UIState>;
  events: CaptureEvent[];
  engine?: CompilerEngine;
  testName?: string;
}

export interface CompileOutput {
  ok: true;
  draft: TestDraft;
  engine: CompilerEngine;
  logs: string[];
}

export interface CompileError {
  ok: false;
  reason: string;
  logs: string[];
}

export function compileDraft(input: CompileInput): CompileOutput | CompileError {
  const logs: string[] = [];
  const engine: CompilerEngine = input.engine ?? "deterministic-local";
  logs.push(`compiler=${engine}`);

  if (input.events.length === 0) {
    return { ok: false, reason: "No capture events recorded.", logs };
  }

  const steps: TestStep[] = [];
  for (let i = 0; i < input.events.length; i++) {
    const ev = input.events[i];
    const beforeState = input.states[ev.beforeStateId];
    const afterState = input.states[ev.afterStateId];
    if (!beforeState || !afterState) {
      return {
        ok: false,
        reason: `Event ${ev.id} references missing state.`,
        logs,
      };
    }
    const targetNode = ev.nodeId ? beforeState.nodes.find((n) => n.nodeId === ev.nodeId) : undefined;
    const selector = targetNode ? rankSelectorsForNode(beforeState, targetNode) : undefined;

    const label = describeAction(ev, targetNode?.text || targetNode?.contentDescription);
    const stepAssertions = deriveStepAssertions(beforeState, afterState, input.intent);

    steps.push({
      id: nextId("step"),
      order: i,
      action: ev.action,
      label,
      selector,
      input: ev.input,
      waitMs: ev.action === "wait" ? 500 : undefined,
      beforeStateId: ev.beforeStateId,
      afterStateId: ev.afterStateId,
      assertions: stepAssertions,
      needsHumanCorrection: ev.action === "unknown",
    });
    logs.push(
      `step[${i}] ${ev.action} target=${targetNode?.role ?? "-"} selector=${selector?.primary.strategy ?? "-"}`
    );
  }

  const lastState = input.states[input.events[input.events.length - 1].afterStateId];
  const finalAssertions = deriveFinalAssertions(lastState, input.intent);
  logs.push(`final assertions=${finalAssertions.length}`);

  const draft: TestDraft = {
    schemaVersion: "pocketqa/test-draft@1",
    id: nextId("draft"),
    name: input.testName ?? deriveName(input.intent),
    intent: input.intent,
    packageName: input.packageName,
    compiledBy: engine,
    createdAt: Date.now(),
    steps,
    finalAssertions,
    offlineOnly: engine === "deterministic-local",
  };

  const parsed = TestDraftSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, reason: `Schema validation failed: ${parsed.error.message}`, logs };
  }
  return { ok: true, draft: parsed.data, engine, logs };
}

function describeAction(ev: CaptureEvent, target?: string): string {
  switch (ev.action) {
    case "tap":
      return target ? `Tap "${target}"` : "Tap element";
    case "longPress":
      return target ? `Long-press "${target}"` : "Long-press element";
    case "typeText":
      return target ? `Type "${ev.input ?? ""}" into "${target}"` : `Type "${ev.input ?? ""}"`;
    case "clearText":
      return "Clear text input";
    case "back":
      return "Navigate back";
    case "scroll":
      return "Scroll";
    case "wait":
      return "Wait for UI to settle";
    case "launch":
      return "Launch target app";
    default:
      return "Unrecognised action — please review";
  }
}

function deriveName(intent: string): string {
  const cleaned = intent.trim().replace(/\.$/, "");
  return cleaned.length > 60 ? cleaned.slice(0, 57) + "…" : cleaned;
}

/**
 * Candidate assertions per PRD FR-COM-002.
 *
 * We diff before/after state and emit assertions for text that becomes visible
 * or disappears, plus any tokens from the intent that surface on-screen.
 */
export function deriveStepAssertions(
  before: UIState,
  after: UIState,
  intent: string
): Assertion[] {
  const beforeText = collectVisibleText(before);
  const afterText = collectVisibleText(after);
  const newlyVisible = [...afterText].filter((t) => !beforeText.has(t));
  const disappeared = [...beforeText].filter((t) => !afterText.has(t));
  const intentTokens = extractIntentTokens(intent);

  const out: Assertion[] = [];
  for (const text of newlyVisible) {
    if (intentTokens.some((tok) => text.toLowerCase().includes(tok))) {
      out.push({
        id: nextId("assert"),
        kind: "textVisible",
        target: text,
        expected: text,
        sourceStateId: after.id,
        supported: true,
        reason: `"${text}" appeared and matches intent keyword.`,
      });
    }
  }
  for (const text of disappeared) {
    if (/error|failed|denied|declined/i.test(text)) {
      out.push({
        id: nextId("assert"),
        kind: "textAbsent",
        target: text,
        expected: text,
        sourceStateId: after.id,
        supported: true,
        reason: `Error text "${text}" cleared after this step.`,
      });
    }
  }
  return out.slice(0, 3);
}

/**
 * Final assertions — at least one end-state assertion is required (FR-COM-002).
 */
export function deriveFinalAssertions(state: UIState, intent: string): Assertion[] {
  const tokens = extractIntentTokens(intent);
  const visible = collectVisibleText(state);
  const out: Assertion[] = [];
  for (const text of visible) {
    if (tokens.some((tok) => text.toLowerCase().includes(tok))) {
      out.push({
        id: nextId("assert"),
        kind: "textVisible",
        target: text,
        expected: text,
        sourceStateId: state.id,
        supported: true,
        reason: `Final state contains "${text}" matching intent.`,
      });
    }
  }
  if (out.length === 0) {
    // Fallback — pick the largest visible label as an end-state anchor.
    const largest = state.nodes
      .filter((n) => n.visible && n.text && !n.sensitive)
      .sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0))[0];
    if (largest?.text) {
      out.push({
        id: nextId("assert"),
        kind: "textVisible",
        target: largest.text,
        expected: largest.text,
        sourceStateId: state.id,
        supported: true,
        reason: "End-state anchor — no intent keyword matched.",
      });
    }
  }
  return out;
}

function collectVisibleText(state: UIState): Set<string> {
  const set = new Set<string>();
  for (const n of state.nodes) {
    if (n.visible && n.text && !n.sensitive) set.add(n.text);
  }
  for (const t of state.ocrText) set.add(t);
  return set;
}

export function extractIntentTokens(intent: string): string[] {
  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "with", "after", "before", "when",
    "if", "verify", "check", "ensure", "that", "still", "remains", "is", "are",
    "should", "must", "then", "does", "not", "do", "to", "of", "in", "on", "at",
    "my", "i", "we", "our", "please", "make", "sure",
  ]);
  return intent
    .toLowerCase()
    .replace(/[^a-z0-9\s%$]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w));
}
