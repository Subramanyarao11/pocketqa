import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { EvidenceScreen } from "../EvidenceScreen";
import { PocketQaNative } from "@native";

const summary = {
  runId: "r1",
  test: {
    id: "t1", version: 1, name: "Coupon", intent: "Verify SAVE20 stays applied.",
    packageName: "com.pocketqa.demoshop", compiledBy: "deterministic-local",
    schemaHash: "abcd", schemaVersion: "pocketqa/approved-test@1",
    createdAt: 0, approvedAt: 0, steps: [], finalAssertions: [], offlineOnly: true,
  },
  result: {
    runId: "r1", testId: "t1", testVersion: 1, startedAt: 0, finishedAt: 10,
    passed: false, offline: true, stepResults: [], assertionResults: [],
    failure: { category: "selector-drift", summary: "Selector no longer resolves" },
  },
} as never;

describe("EvidenceScreen", () => {
  beforeEach(() => {
    jest.spyOn(PocketQaNative, "getRun").mockResolvedValue(summary);
    jest.spyOn(PocketQaNative, "getEvidenceTimeline").mockResolvedValue([]);
    jest.spyOn(PocketQaNative, "getFailureProposal").mockResolvedValue({
      runId: "r1",
      stepId: "step-1",
      category: "selector-drift",
      summary: "Selector no longer resolves",
      suggestion: "Promote fallback selector resourceId=shop:coupon-apply.",
      action: { kind: "promote-fallback", strategy: "resourceId", value: "shop:coupon-apply" },
    } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  const nav: { goBack: jest.Mock; navigate: jest.Mock; replace: jest.Mock } = {
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(),
  };
  const route = { params: { runId: "r1" } } as unknown as never;

  it("shows FAIL pill, failure category, and the Detective card", async () => {
    render(<EvidenceScreen navigation={nav as never} route={route} />);
    await waitFor(() => expect(screen.getByText("FAIL")).toBeTruthy());
    expect(screen.getByText(/\[selector-drift\]/)).toBeTruthy();
    expect(screen.getByText(/Failure Detective/)).toBeTruthy();
    expect(screen.getByText(/Promote fallback selector/)).toBeTruthy();
  });

  it("Share YAML button invokes exportTest then shareArtifact", async () => {
    const exportTest = jest.spyOn(PocketQaNative, "exportTest").mockResolvedValue({
      uri: "content://x", mimeType: "text/yaml", filename: "x.yaml", redacted: true,
    } as never);
    const share = jest.spyOn(PocketQaNative, "shareArtifact").mockResolvedValue(undefined as never);
    render(<EvidenceScreen navigation={nav as never} route={route} />);
    await waitFor(() => expect(screen.getByText(/Share YAML/)).toBeTruthy());
    fireEvent.press(screen.getByText(/Share YAML/));
    await waitFor(() => expect(exportTest).toHaveBeenCalledWith("t1", 1));
    await waitFor(() => expect(share).toHaveBeenCalledWith("content://x", "text/yaml"));
  });
});
