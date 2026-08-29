import type { ReplayHarness } from "./executor";
import type { UIState } from "./schemas";
import type { ShopAction, ShopState } from "../demo-shop/model";
import { reduceShop, snapshotShop } from "../demo-shop/model";

/**
 * The web replay harness — drives the Demo Shop via its reducer.  On Android
 * this is replaced by a Kotlin bridge that dispatches to AccessibilityService.
 */
export interface WebHarnessOptions {
  getState: () => ShopState;
  setState: (s: ShopState) => void;
  onEvent?: (label: string) => void;
  delayMs?: number;
}

export function createWebHarness(opts: WebHarnessOptions): ReplayHarness {
  const delay = opts.delayMs ?? 200;
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const dispatch = (a: ShopAction) => opts.setState(reduceShop(opts.getState(), a));

  return {
    activePackageName() {
      return opts.getState().packageName;
    },
    currentState(): UIState {
      return snapshotShop(opts.getState());
    },
    async performTap(nodeId: string) {
      opts.onEvent?.(`tap ${nodeId}`);
      const state = opts.getState();
      // Translate node taps back to reducer actions.
      if (nodeId.startsWith("product-card-")) {
        dispatch({ type: "openProduct", productId: nodeId.replace("product-card-", "") });
      } else if (nodeId === "add-to-cart-btn" && state.selectedProductId) {
        dispatch({ type: "addToCart", productId: state.selectedProductId });
      } else if (nodeId === "cart-badge") {
        dispatch({ type: "openCart" });
      } else if (nodeId === "back-to-list") {
        dispatch({ type: "backToList" });
      } else if (nodeId === "coupon-apply-btn") {
        dispatch({ type: "applyCoupon" });
      } else if (nodeId === "continue-checkout-btn") {
        dispatch({ type: "continueToCheckout" });
        // deterministic tick — advance the checkout state machine.
        await wait(400);
        opts.setState(reduceShop(opts.getState(), { type: "checkoutTick" }));
      } else if (nodeId === "retry-btn") {
        dispatch({ type: "retryCheckout" });
      } else if (nodeId === "coupon-details-btn") {
        dispatch({ type: "focusNode", nodeId });
      }
      await wait(delay);
    },
    async performTypeText(nodeId: string, value: string) {
      opts.onEvent?.(`type "${value}" into ${nodeId}`);
      if (nodeId === "coupon-input") {
        dispatch({ type: "typeCoupon", value });
      }
      await wait(delay);
    },
    async performBack() {
      opts.onEvent?.("back");
      const state = opts.getState();
      if (state.screen === "detail") dispatch({ type: "backToList" });
      await wait(delay);
    },
    async performLaunch(_pkg: string) {
      opts.onEvent?.("launch");
      await wait(delay);
    },
    async waitForIdle(ms: number) {
      await wait(ms);
    },
    async resetFixture() {
      opts.onEvent?.("reset fixture");
      opts.setState(reduceShop(opts.getState(), { type: "reset" }));
      await wait(delay);
    },
  };
}
