import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { SelectorCandidatesScreen } from "../SelectorCandidatesScreen";
import { PocketQaNative } from "@native";

/**
 * The mock façade returns a synthesised candidate list; we assert that the
 * screen renders the list and calls promoteFallbackSelector when the user
 * confirms a different candidate.
 */
describe("SelectorCandidatesScreen", () => {
  beforeEach(() => jest.spyOn(PocketQaNative, "listSelectorCandidates").mockResolvedValue([
    { index: 0, strategy: "testId", value: "add-to-cart", confidence: 0.98, reason: "Explicit testId.", isPrimary: true },
    { index: 1, strategy: "resourceId", value: "shop:add-to-cart", confidence: 0.94, reason: "Resource ID.", isPrimary: false },
    { index: 2, strategy: "textAndRole", value: "Add to cart", confidence: 0.82, reason: "Text match.", isPrimary: false },
  ]));
  afterEach(() => jest.restoreAllMocks());

  const nav: { goBack: jest.Mock; navigate: jest.Mock; replace: jest.Mock } = {
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(),
  };
  const route = { params: { draftId: "d1", stepId: "s1" } } as unknown as never;

  it("renders the ranked candidates", async () => {
    render(<SelectorCandidatesScreen navigation={nav as never} route={route} />);
    await waitFor(() => expect(screen.getByText(/testId = add-to-cart/)).toBeTruthy());
    expect(screen.getByText(/resourceId = shop:add-to-cart/)).toBeTruthy();
    expect(screen.getByText(/textAndRole = Add to cart/)).toBeTruthy();
  });

  it("disables Use-this-selector when the current primary is still selected", async () => {
    render(<SelectorCandidatesScreen navigation={nav as never} route={route} />);
    await waitFor(() => expect(screen.getByText(/Use this selector/)).toBeTruthy());
    const btn = screen.getByRole("button", { name: "Use this selector" });
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("promotes a fallback and navigates back on confirm", async () => {
    const promote = jest.spyOn(PocketQaNative, "promoteFallbackSelector").mockResolvedValue({} as never);
    // Draft reload after promotion goes through PocketQaNative.getDraft;
    // return a stub so the store hydrates without throwing.
    jest.spyOn(PocketQaNative, "getDraft").mockResolvedValue({
      schemaVersion: "pocketqa/test-draft@1", id: "d1", name: "t", intent: "verify",
      packageName: "com.pocketqa.demoshop", compiledBy: "deterministic-local",
      createdAt: 0, steps: [], finalAssertions: [], offlineOnly: true,
    } as never);
    render(<SelectorCandidatesScreen navigation={nav as never} route={route} />);
    await waitFor(() => expect(screen.getByText(/resourceId = shop:add-to-cart/)).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/resourceId candidate/i));
    // React 19 does not flush this state update before the next query, so
    // reading the button immediately finds it still disabled and swallows the
    // press. Wait for the selection to land before confirming.
    await waitFor(() =>
      expect(screen.getAllByRole("radio")[1].props.accessibilityState?.selected).toBe(true),
    );
    fireEvent.press(screen.getByRole("button", { name: "Use this selector" }));
    await waitFor(() => expect(promote).toHaveBeenCalledWith("d1", "s1", 1));
    await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
  });
});
