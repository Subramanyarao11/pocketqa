import { rankSelectorsForNode, resolveSelector } from "../selectors";
import type { CapturedNode, UIState } from "../schemas";

function state(nodes: CapturedNode[]): UIState {
  return {
    id: "s",
    packageName: "com.pocketqa.demoshop",
    screenName: "test",
    capturedAt: 0,
    ocrText: [],
    nodes,
  };
}

const node = (o: Partial<CapturedNode>): CapturedNode => ({
  nodeId: "n1", role: "button", enabled: true, visible: true, sensitive: false, ...o,
});

describe("rankSelectorsForNode", () => {
  it("prefers testId over resourceId over text", () => {
    const n = node({ testId: "add-to-cart", resourceId: "shop:add-to-cart", text: "Add to cart" });
    const ranked = rankSelectorsForNode(state([n]), n);
    expect(ranked.primary.strategy).toBe("testId");
    expect(ranked.primary.confidence).toBeGreaterThan(0.9);
  });

  it("penalises confidence when text is ambiguous across nodes", () => {
    const a = node({ nodeId: "a", text: "OK", role: "button" });
    const b = node({ nodeId: "b", text: "OK", role: "button" });
    const ranked = rankSelectorsForNode(state([a, b]), a);
    const text = ranked.primary.strategy === "textAndRole" ? ranked.primary : ranked.fallbacks.find((f) => f.strategy === "textAndRole");
    expect(text?.confidence).toBeLessThan(0.7);
  });

  it("never puts coordinates in fallbacks", () => {
    const n = node({ text: "Foo", bounds: { x: 0, y: 0, w: 10, h: 10 } });
    const ranked = rankSelectorsForNode(state([n]), n);
    expect(ranked.fallbacks.every((f) => f.strategy !== "coordinates")).toBe(true);
  });
});

describe("resolveSelector", () => {
  it("returns TARGET_NOT_FOUND when the tree lacks the value", () => {
    const n = node({ testId: "add-to-cart" });
    const ranked = rankSelectorsForNode(state([n]), n);
    const empty = state([node({ nodeId: "other", testId: "other" })]);
    const res = resolveSelector(ranked, empty);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TARGET_NOT_FOUND");
  });

  it("returns TARGET_AMBIGUOUS if every strategy matches multiple nodes", () => {
    const a = node({ nodeId: "a", text: "OK", role: "button" });
    const b = node({ nodeId: "b", text: "OK", role: "button" });
    const ranked = rankSelectorsForNode(state([a, b]), a);
    const res = resolveSelector(ranked, state([a, b]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TARGET_AMBIGUOUS");
  });
});
