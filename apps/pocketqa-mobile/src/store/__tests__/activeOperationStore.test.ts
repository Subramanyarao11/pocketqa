import { useActiveOperationStore } from "../activeOperationStore";

describe("activeOperationStore", () => {
  beforeEach(() => {
    useActiveOperationStore.setState({ active: undefined, lastHardStop: undefined });
  });

  it("stores CAPTURE_PROGRESS events as the active operation", () => {
    useActiveOperationStore.getState().applyEvent({
      type: "CAPTURE_PROGRESS",
      payload: {
        sessionId: "sess-1", state: "recording", stepCount: 2, elapsedMs: 120,
        packageName: "com.pocketqa.demoshop",
      },
    });
    const active = useActiveOperationStore.getState().active;
    expect(active?.kind).toBe("CAPTURE");
    expect(active?.id).toBe("sess-1");
  });

  it("captures a hard stop and clears the active operation", () => {
    useActiveOperationStore.getState().applyEvent({
      type: "CAPTURE_HARD_STOP",
      payload: {
        operationId: "sess-1", code: "BLOCKED_CATEGORY",
        category: "blocked", message: "Purchase attempted",
      },
    });
    const s = useActiveOperationStore.getState();
    expect(s.active).toBeUndefined();
    expect(s.lastHardStop?.code).toBe("BLOCKED_CATEGORY");
  });

  it("dismissHardStop clears the banner", () => {
    useActiveOperationStore.setState({
      lastHardStop: { operationId: "x", code: "c", category: "user", message: "m" },
    });
    useActiveOperationStore.getState().dismissHardStop();
    expect(useActiveOperationStore.getState().lastHardStop).toBeUndefined();
  });
});
