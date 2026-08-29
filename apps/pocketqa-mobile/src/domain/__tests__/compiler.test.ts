import { compileDraft, deriveFinalAssertions, extractIntentTokens } from "../compiler";
import type { CaptureEvent, UIState, CapturedNode } from "../schemas";

const node = (o: Partial<CapturedNode>): CapturedNode => ({
  nodeId: "n", role: "button", enabled: true, visible: true, sensitive: false, ...o,
});

const state = (id: string, nodes: CapturedNode[]): UIState => ({
  id, packageName: "com.pocketqa.demoshop", screenName: id,
  capturedAt: 0, ocrText: [], nodes,
});

describe("extractIntentTokens", () => {
  it("filters stop words and short tokens", () => {
    const t = extractIntentTokens("Verify the coupon SAVE20 stays applied");
    expect(t).toContain("coupon");
    expect(t).toContain("save20");
    expect(t).not.toContain("the");
    expect(t).not.toContain("is");
  });
});

describe("compileDraft", () => {
  it("returns a schema-valid draft with steps and final assertions", () => {
    const before = state("s1", [node({ testId: "add-to-cart", text: "Add to cart" })]);
    const after = state("s2", [node({ nodeId: "cart-badge", testId: "open-cart", text: "Cart (1)" })]);
    const ev: CaptureEvent = {
      id: "e1", at: 1, action: "tap", nodeId: "n", beforeStateId: "s1", afterStateId: "s2",
    };
    const out = compileDraft({
      intent: "Verify Cart shows one item after Add to cart.",
      packageName: "com.pocketqa.demoshop",
      states: { s1: before, s2: after },
      events: [ev],
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.draft.steps).toHaveLength(1);
      expect(out.draft.steps[0].selector?.primary.strategy).toBe("testId");
    }
  });

  it("fails cleanly when there are no events", () => {
    const out = compileDraft({
      intent: "empty case",
      packageName: "com.pocketqa.demoshop",
      states: {},
      events: [],
    });
    expect(out.ok).toBe(false);
  });
});

describe("deriveFinalAssertions", () => {
  it("falls back to the largest visible label when no intent token matches", () => {
    const s = state("s", [node({ text: "Welcome banner large enough to stand out" })]);
    const out = deriveFinalAssertions(s, "no matching tokens whatsoever");
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].kind).toBe("textVisible");
  });
});
