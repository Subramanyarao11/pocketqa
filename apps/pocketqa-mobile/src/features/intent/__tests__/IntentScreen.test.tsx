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
    // The intent field starts empty by design — the operator supplies the one
    // thing PocketQA cannot infer — and Continue stays disabled below ten
    // characters, so the test has to type what a user would type.
    fireEvent.changeText(screen.getByLabelText("Intent"), "Coupon SAVE20 stays applied in the cart");
    fireEvent.press(screen.getByRole("checkbox"));
    // Continue is gated on the consent checkbox. React 19 defers that state
    // update, so querying the button in the same tick finds it still disabled
    // and the press is ignored.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continue" }).props.accessibilityState?.disabled,
      ).toBe(false),
    );
    fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(PocketQaNative.createIntent).toHaveBeenCalled());
    // targetName travels with the intent so the pre-capture screen can name the
    // chosen app rather than assuming Demo Shop.
    expect(nav.navigate).toHaveBeenCalledWith("CaptureReady", {
      intentId: "i1",
      targetName: "PocketQA Demo Shop",
    });
  });
});
