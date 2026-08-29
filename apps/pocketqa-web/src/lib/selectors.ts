import type { CapturedNode, RankedSelector, Selector, UIState } from "./schemas";

/**
 * Selector ranking — PRD §11.4 FR-COM-003.
 *
 * Prefer stable, semantic strategies.  Coordinates are review-only.
 */

export function rankSelectorsForNode(
  state: UIState,
  node: CapturedNode
): RankedSelector {
  const candidates: Selector[] = [];
  const totalMatching = (predicate: (n: CapturedNode) => boolean) =>
    state.nodes.filter(predicate).length;

  if (node.testId) {
    candidates.push({
      strategy: "testId",
      value: node.testId,
      role: node.role,
      confidence: 0.98,
      reason: `Explicit testId "${node.testId}" is the most stable anchor.`,
    });
  }
  if (node.resourceId) {
    candidates.push({
      strategy: "resourceId",
      value: node.resourceId,
      role: node.role,
      confidence: 0.94,
      reason: `Resource ID "${node.resourceId}" is emitted by the app build.`,
    });
  }
  if (node.contentDescription) {
    const dupes = totalMatching((n) => n.contentDescription === node.contentDescription);
    candidates.push({
      strategy: "accessibilityLabel",
      value: node.contentDescription,
      role: node.role,
      confidence: dupes === 1 ? 0.9 : 0.65,
      reason:
        dupes === 1
          ? `Accessibility label uniquely identifies this ${node.role}.`
          : `Accessibility label matches ${dupes} nodes; disambiguation added.`,
    });
  }
  if (node.text) {
    const dupes = totalMatching((n) => n.text === node.text && n.role === node.role);
    candidates.push({
      strategy: "textAndRole",
      value: node.text,
      role: node.role,
      confidence: dupes === 1 ? 0.82 : 0.55,
      reason:
        dupes === 1
          ? `Visible "${node.text}" ${node.role} appears exactly once.`
          : `Visible text matches ${dupes} ${node.role}s — brittle.`,
    });
  }
  if (node.bounds) {
    candidates.push({
      strategy: "coordinates",
      value: `${Math.round(node.bounds.x + node.bounds.w / 2)},${Math.round(
        node.bounds.y + node.bounds.h / 2
      )}`,
      role: node.role,
      confidence: 0.2,
      reason: "Coordinate fallback — brittle. Review-only.",
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const primary = candidates[0] || {
    strategy: "textAndRole",
    value: node.role,
    role: node.role,
    confidence: 0.1,
    reason: "No stable anchor available.",
  };
  const fallbacks = candidates.slice(1, 3).filter((c) => c.strategy !== "coordinates");
  return {
    primary,
    fallbacks,
    candidateCount: candidates.length,
  };
}

/**
 * Resolve a selector against a live state.  Returns the matching node or
 * throws a structured code that maps to PRD FR-RUN-002.
 */
export type ResolveResult =
  | { ok: true; node: CapturedNode; strategy: string; usedFallback: boolean }
  | { ok: false; code: "TARGET_NOT_FOUND" | "TARGET_AMBIGUOUS"; message: string };

export function resolveSelector(
  ranked: RankedSelector,
  state: UIState
): ResolveResult {
  const strategies = [ranked.primary, ...ranked.fallbacks];
  for (let i = 0; i < strategies.length; i++) {
    const sel = strategies[i];
    const matches = matchNodes(sel, state);
    if (matches.length === 1) {
      return {
        ok: true,
        node: matches[0],
        strategy: sel.strategy,
        usedFallback: i > 0,
      };
    }
    if (matches.length > 1) {
      // Try next strategy; if all ambiguous, fail.
      if (i === strategies.length - 1) {
        return {
          ok: false,
          code: "TARGET_AMBIGUOUS",
          message: `${matches.length} nodes matched "${sel.value}" (${sel.strategy}).`,
        };
      }
      continue;
    }
  }
  return {
    ok: false,
    code: "TARGET_NOT_FOUND",
    message: `No node matched ${ranked.primary.strategy} "${ranked.primary.value}".`,
  };
}

function matchNodes(sel: Selector, state: UIState): CapturedNode[] {
  return state.nodes.filter((n) => {
    if (!n.visible) return false;
    switch (sel.strategy) {
      case "testId": return n.testId === sel.value;
      case "resourceId": return n.resourceId === sel.value;
      case "accessibilityLabel": return n.contentDescription === sel.value;
      case "textAndRole": return n.text === sel.value && (!sel.role || n.role === sel.role);
      case "roleAndRelation": return n.role === sel.role;
      case "relativePosition": return n.testId === sel.value; // simplified in demo
      case "coordinates": return false; // never resolve by coords in executor
    }
    return false;
  });
}
