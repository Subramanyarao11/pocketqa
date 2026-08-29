import type {
  Assertion,
  CapturedNode,
  Mission,
  MissionEvent,
  MissionTool,
  UIState,
} from "./schemas";
import { ALLOWLISTED_PACKAGES, checkNode, checkPackageBoundary } from "./policy";
import { rankSelectorsForNode } from "./selectors";
import { nextId } from "./ids";
import type { ReplayHarness } from "./executor";

/**
 * Explorer Lab — PRD §11.8.
 *
 * Deterministic BFS-style planner over policy-approved candidate nodes.  It
 * observes the current state, ranks candidates it hasn't taken before, and
 * executes at most `maxActions` taps through the same deterministic executor.
 *
 * Explorer *proposes* new states/assertions.  It never mutates the library.
 */

export interface ExplorerHooks {
  onEvent?: (ev: MissionEvent) => void;
  stopSignal?: { stopped: boolean };
}

export interface ExplorerProposal {
  discoveredStateId: string;
  candidateAssertions: Assertion[];
  transitionPath: string[]; // ordered nodeIds tapped to reach it
  summary: string;
}

export async function runMission(
  mission: Mission,
  harness: ReplayHarness,
  hooks: ExplorerHooks = {}
): Promise<{ events: MissionEvent[]; proposal?: ExplorerProposal }> {
  const events: MissionEvent[] = [];
  const emit = (ev: MissionEvent) => {
    events.push(ev);
    hooks.onEvent?.(ev);
  };

  emit({
    at: Date.now(),
    kind: "plan",
    message: `Mission: ${mission.goal}`,
    meta: {
      allowlist: mission.packageAllowlist.join(","),
      budget: String(mission.maxActions),
      seconds: String(mission.maxDurationSeconds),
      tools: mission.allowedTools.join(","),
    },
  });

  const seenScreens = new Set<string>();
  const path: string[] = [];
  const startedAt = Date.now();
  let actionsTaken = 0;
  let deadline = startedAt + mission.maxDurationSeconds * 1000;

  let baselineState = harness.currentState();
  seenScreens.add(baselineState.screenName);
  emit({
    at: Date.now(),
    kind: "observe",
    message: `Baseline screen: ${baselineState.screenName} (${baselineState.nodes.length} nodes)`,
  });

  while (actionsTaken < mission.maxActions && Date.now() < deadline) {
    if (hooks.stopSignal?.stopped) {
      emit({ at: Date.now(), kind: "stop", message: "User stopped mission." });
      break;
    }

    const current = harness.currentState();
    const pkgDecision = checkPackageBoundary(harness.activePackageName(), mission.packageAllowlist);
    if (!pkgDecision.allowed) {
      emit({ at: Date.now(), kind: "policy-block", message: pkgDecision.reason });
      emit({ at: Date.now(), kind: "stop", message: "Hard stop on package boundary." });
      break;
    }

    const candidates = filterCandidates(current, mission.allowedTools, path);
    if (candidates.length === 0) {
      emit({ at: Date.now(), kind: "stop", message: "No policy-approved candidates remain." });
      break;
    }

    // Prefer candidates that reveal new labels (potential new states).
    const chosen = candidates.find((c) => isPromisingCandidate(c, current)) ?? candidates[0];

    const nodeDecision = checkNode(current, chosen);
    if (!nodeDecision.allowed) {
      emit({ at: Date.now(), kind: "policy-block", message: nodeDecision.reason, meta: { code: nodeDecision.code } });
      // Try the next-best candidate on the next iteration by adding to path (skip).
      path.push(chosen.nodeId);
      continue;
    }

    emit({
      at: Date.now(),
      kind: "action",
      message: `tapNode(${chosen.nodeId})`,
      meta: { label: chosen.text || chosen.contentDescription || chosen.role },
    });
    await harness.performTap(chosen.nodeId);
    await harness.waitForIdle(120);
    path.push(chosen.nodeId);
    actionsTaken += 1;

    const after = harness.currentState();
    if (!seenScreens.has(after.screenName)) {
      seenScreens.add(after.screenName);
      const proposal = buildProposal(after, path, mission.goal);
      emit({
        at: Date.now(),
        kind: "propose",
        message: `Discovered new state "${after.screenName}" — proposing ${proposal.candidateAssertions.length} assertions.`,
      });
      emit({ at: Date.now(), kind: "stop", message: "Mission complete — new state found." });
      return { events, proposal };
    }
  }

  if (actionsTaken >= mission.maxActions) {
    emit({ at: Date.now(), kind: "stop", message: `Action budget of ${mission.maxActions} reached — stopping.` });
  } else if (Date.now() >= deadline) {
    emit({ at: Date.now(), kind: "stop", message: "Time budget exceeded — stopping." });
  }
  return { events };
}

function filterCandidates(
  state: UIState,
  tools: MissionTool[],
  path: string[]
): CapturedNode[] {
  if (!tools.includes("tapNode")) return [];
  return state.nodes.filter((n) => {
    if (!n.visible || !n.enabled) return false;
    if (n.sensitive) return false;
    if (n.role !== "button" && n.role !== "row") return false;
    // Coordinates-only nodes are excluded from Explorer per FR-COM-003.
    if (!n.testId && !n.resourceId && !n.contentDescription && !n.text) return false;
    if (path.includes(n.nodeId)) return false;
    return true;
  });
}

function isPromisingCandidate(node: CapturedNode, state: UIState): boolean {
  // Very simple heuristic: a node whose label suggests exploration (details,
  // options, more, info) but not a blocked keyword.
  const label = (node.text || node.contentDescription || "").toLowerCase();
  const promising = ["details", "more", "info", "options", "history"].some((k) => label.includes(k));
  if (promising) return true;
  // Also prefer nodes that don't already exist on other visible screens.
  const otherLabels = new Set(state.nodes.filter((n) => n.nodeId !== node.nodeId).map((n) => n.text));
  return !otherLabels.has(node.text);
}

function buildProposal(state: UIState, path: string[], goal: string): ExplorerProposal {
  const assertions: Assertion[] = [];
  for (const n of state.nodes) {
    if (!n.visible || !n.text) continue;
    // Rank the top 2 most descriptive labels.
    if (n.role === "heading" || n.role === "text" || n.role === "badge") {
      assertions.push({
        id: nextId("assert"),
        kind: "textVisible",
        target: n.text,
        expected: n.text,
        sourceStateId: state.id,
        supported: true,
        reason: `Explorer found "${n.text}" on the newly discovered "${state.screenName}" screen.`,
      });
      // include the ranked selector reasoning for realism
      rankSelectorsForNode(state, n);
    }
    if (assertions.length >= 2) break;
  }
  return {
    discoveredStateId: state.id,
    candidateAssertions: assertions,
    transitionPath: path,
    summary: `Mission goal "${goal}" — discovered ${state.screenName} state via ${path.length} action(s).`,
  };
}
