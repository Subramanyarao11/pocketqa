import type { CapturedNode, UIState } from "./schemas";

/**
 * Safety policy — see PRD §12.
 *
 * Pure predicates over captured evidence.  The executor consults this before
 * every action; the Explorer consults this before every candidate.  A failure
 * anywhere in this chain hard-stops.
 */

export const ALLOWLISTED_PACKAGES = ["com.techphantoms.pocketqa.demoshop"];

const BLOCKED_KEYWORDS = [
  "pay", "checkout complete", "confirm order", "place order", "purchase",
  "buy now", "delete account", "sign out permanent",
  "grant permission", "allow permission", "accept terms",
  "send message", "call now",
  "install", "uninstall",
];

const SENSITIVE_ROLES = ["passwordField", "otpField", "pinField"];

const SENSITIVE_PATTERNS: RegExp[] = [
  /password/i,
  /\botp\b/i,
  /\bcvv\b/i,
  /card\s?number/i,
  /\bpin\b/i,
  /biometric/i,
];

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; code: PolicyCode; reason: string };

export type PolicyCode =
  | "PACKAGE_BOUNDARY_VIOLATION"
  | "SENSITIVE_TARGET_BLOCKED"
  | "BLOCKED_CATEGORY"
  | "TARGET_NOT_FOUND"
  | "TARGET_AMBIGUOUS"
  | "COORDINATES_NOT_ALLOWED"
  | "BUDGET_EXCEEDED";

export function checkPackageBoundary(
  observed: string,
  allowlist: string[]
): PolicyDecision {
  if (!allowlist.includes(observed)) {
    return {
      allowed: false,
      code: "PACKAGE_BOUNDARY_VIOLATION",
      reason: `Active package ${observed} is not in the mission allowlist.`,
    };
  }
  return { allowed: true };
}

export function isSensitiveNode(node: CapturedNode): boolean {
  if (node.sensitive) return true;
  if (SENSITIVE_ROLES.includes(node.role)) return true;
  const haystack = [node.text, node.contentDescription, node.resourceId, node.testId]
    .filter(Boolean)
    .join(" ");
  return SENSITIVE_PATTERNS.some((r) => r.test(haystack));
}

export function isBlockedCategory(state: UIState, targetNode: CapturedNode): PolicyDecision {
  const combined = [
    targetNode.text,
    targetNode.contentDescription,
    targetNode.resourceId,
    targetNode.testId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hit = BLOCKED_KEYWORDS.find((kw) => combined.includes(kw));
  if (hit) {
    return {
      allowed: false,
      code: "BLOCKED_CATEGORY",
      reason: `Target contains blocked action keyword "${hit}" (PRD §12.1).`,
    };
  }
  // Also scan surrounding OCR text for irreversible confirm prompts.
  const ocr = state.ocrText.join(" ").toLowerCase();
  if (/\b(confirm.+payment|charge.+card)\b/.test(ocr)) {
    return {
      allowed: false,
      code: "BLOCKED_CATEGORY",
      reason: "Screen text suggests payment confirmation — hard stop.",
    };
  }
  return { allowed: true };
}

export function checkNode(state: UIState, node: CapturedNode | undefined): PolicyDecision {
  if (!node) return { allowed: false, code: "TARGET_NOT_FOUND", reason: "Selector matched no node." };
  if (isSensitiveNode(node)) {
    return {
      allowed: false,
      code: "SENSITIVE_TARGET_BLOCKED",
      reason: `Target is a sensitive field (${node.role || node.resourceId || node.testId}).`,
    };
  }
  return isBlockedCategory(state, node);
}

/**
 * A convenience "hard stop" registry — Explorer and executor push here so the
 * user always sees the full trace of policy decisions.
 */
export interface PolicyLogEntry {
  at: number;
  decision: PolicyDecision;
  action: string;
  target?: string;
}
