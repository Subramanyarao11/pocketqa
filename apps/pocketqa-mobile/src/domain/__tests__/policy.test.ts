import {
  ALLOWLISTED_PACKAGES, checkNode, checkPackageBoundary, isBlockedCategory, isSensitiveNode,
} from "../policy";
import type { CapturedNode, UIState } from "../schemas";

const node = (o: Partial<CapturedNode>): CapturedNode => ({
  nodeId: "n1", role: "button", enabled: true, visible: true, sensitive: false, ...o,
});

const state = (nodes: CapturedNode[], ocr: string[] = []): UIState => ({
  id: "s", packageName: "com.pocketqa.demoshop", screenName: "test",
  capturedAt: 0, ocrText: ocr, nodes,
});

describe("checkPackageBoundary", () => {
  it("passes for allowlisted packages", () => {
    const d = checkPackageBoundary(ALLOWLISTED_PACKAGES[0], ALLOWLISTED_PACKAGES);
    expect(d.allowed).toBe(true);
  });
  it("blocks cross-package with the PACKAGE_BOUNDARY_VIOLATION code", () => {
    const d = checkPackageBoundary("com.bank.app", ALLOWLISTED_PACKAGES);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe("PACKAGE_BOUNDARY_VIOLATION");
  });
});

describe("isSensitiveNode", () => {
  it("catches password fields by role", () => {
    expect(isSensitiveNode(node({ role: "passwordField" }))).toBe(true);
  });
  it("catches sensitive patterns in text", () => {
    expect(isSensitiveNode(node({ text: "Enter OTP" }))).toBe(true);
  });
  it("passes safe buttons", () => {
    expect(isSensitiveNode(node({ text: "Add to cart" }))).toBe(false);
  });
});

describe("isBlockedCategory", () => {
  it("blocks payment confirmations from surrounding OCR", () => {
    const decision = isBlockedCategory(state([], ["Confirm payment on card ending 1234"]), node({ text: "OK" }));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("BLOCKED_CATEGORY");
  });
  it("blocks purchase actions on the target label", () => {
    const decision = isBlockedCategory(state([]), node({ text: "Buy now" }));
    expect(decision.allowed).toBe(false);
  });
});

describe("checkNode", () => {
  it("returns TARGET_NOT_FOUND when the node is undefined", () => {
    const d = checkNode(state([]), undefined);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe("TARGET_NOT_FOUND");
  });
});
