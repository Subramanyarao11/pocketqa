import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { IntentScreen } from "../IntentScreen";
import { PocketQaNative } from "@native";

describe("IntentScreen", () => {
  beforeEach(() => {
    jest.spyOn(PocketQaNative, "listAllowlistedApps").mockResolvedValue([
      { packageName: "com.pocketqa.demoshop", displayName: "PocketQA Demo Shop", fixtureIds: ["reset"] },
    ]);
    jest.spyOn(PocketQaNative, "createIntent").mockResolvedValue({ intentId: "i1" } as never);
  });
  afterEach(() => jest.restoreAllMocks());

  const nav: { goBack: jest.Mock; navigate: jest.Mock; replace: jest.Mock } = {
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(),
  };

  it("Continue is disabled until package + consent + valid intent", async () => {
    render(<IntentScreen navigation={nav as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByText(/PocketQA Demo Shop/)).toBeTruthy());
    const btn = screen.getByRole("button", { name: "Continue" });
    // No consent yet — button reports disabled via accessibilityState.
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("Continue creates the intent and navigates to CaptureReady", async () => {
    render(<IntentScreen navigation={nav as never} route={{} as never} />);
    await waitFor(() => expect(screen.getByText(/PocketQA Demo Shop/)).toBeTruthy());
    fireEvent.press(screen.getByRole("checkbox"));
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(PocketQaNative.createIntent).toHaveBeenCalled());
    expect(nav.navigate).toHaveBeenCalledWith("CaptureReady", { intentId: "i1" });
  });
});
