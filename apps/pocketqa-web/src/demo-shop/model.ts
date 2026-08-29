import type { CapturedNode, UIState } from "../lib/schemas";
import { djb2 } from "../lib/ids";

/**
 * PocketQA Demo Shop — deterministic target app (PRD §16).
 *
 * The shop is a pure state machine.  UI is a thin projection.  Because every
 * transition is deterministic, PocketQA can:
 *   - reset it to a known fixture,
 *   - snapshot a normalized accessibility tree at every stable state,
 *   - replay against it without flake.
 */

export type ShopScreen =
  | "list"
  | "detail"
  | "cart"
  | "checkout-loading"
  | "checkout-failed"
  | "checkout-success";

export interface Product {
  id: string;
  name: string;
  price: number;
  emoji: string;
  description: string;
}

export const PRODUCTS: Product[] = [
  { id: "sneakers", name: "Retro Sneakers", price: 4200, emoji: "👟", description: "Cushioned trainers with a retro silhouette." },
  { id: "tee", name: "Classic Tee", price: 899, emoji: "👕", description: "Soft cotton crew-neck." },
  { id: "cap", name: "Runner Cap", price: 649, emoji: "🧢", description: "Breathable cap with a curved brim." },
];

export const COUPON_VALID = "SAVE20";

export interface ShopState {
  screen: ShopScreen;
  packageName: string;
  selectedProductId: string | null;
  cartItems: string[];
  couponInput: string;
  couponApplied: string | null;
  lastError: string | null;
  driftEnabled: boolean; // fixture toggle for AT-07
  focusedNodeId: string | null;
  fixture: "reset" | "coupon-retry" | "selector-drift";
}

export const INITIAL_SHOP_STATE: ShopState = {
  screen: "list",
  packageName: "com.pocketqa.demoshop",
  selectedProductId: null,
  cartItems: [],
  couponInput: "",
  couponApplied: null,
  lastError: null,
  driftEnabled: false,
  focusedNodeId: null,
  fixture: "reset",
};

export type ShopAction =
  | { type: "reset"; fixture?: ShopState["fixture"] }
  | { type: "openProduct"; productId: string }
  | { type: "addToCart"; productId: string }
  | { type: "openCart" }
  | { type: "backToList" }
  | { type: "typeCoupon"; value: string }
  | { type: "applyCoupon" }
  | { type: "continueToCheckout" }
  | { type: "checkoutTick" }
  | { type: "retryCheckout" }
  | { type: "focusNode"; nodeId: string | null };

export function reduceShop(state: ShopState, action: ShopAction): ShopState {
  switch (action.type) {
    case "reset": {
      const fixture = action.fixture ?? "reset";
      return {
        ...INITIAL_SHOP_STATE,
        fixture,
        driftEnabled: fixture === "selector-drift",
      };
    }
    case "openProduct":
      return { ...state, screen: "detail", selectedProductId: action.productId };
    case "addToCart":
      return {
        ...state,
        cartItems: state.cartItems.includes(action.productId)
          ? state.cartItems
          : [...state.cartItems, action.productId],
      };
    case "openCart":
      return { ...state, screen: "cart" };
    case "backToList":
      return { ...state, screen: "list", selectedProductId: null };
    case "typeCoupon":
      return { ...state, couponInput: action.value };
    case "applyCoupon":
      if (state.couponInput.trim().toUpperCase() === COUPON_VALID) {
        return { ...state, couponApplied: COUPON_VALID, lastError: null };
      }
      return { ...state, couponApplied: null, lastError: "Coupon not recognised" };
    case "continueToCheckout":
      return { ...state, screen: "checkout-loading", lastError: null };
    case "checkoutTick":
      // deterministic: first pass always fails; retry succeeds.
      if (state.screen === "checkout-loading" && !state.lastError) {
        return {
          ...state,
          screen: "checkout-failed",
          lastError: "Simulated payment gateway timeout",
        };
      }
      return state;
    case "retryCheckout":
      // On retry we succeed, keeping the coupon applied.
      return {
        ...state,
        screen: "checkout-success",
        lastError: null,
      };
    case "focusNode":
      return { ...state, focusedNodeId: action.nodeId };
  }
}

/**
 * Snapshot — projects the ShopState to a PocketQA UIState.  This is the
 * "accessibility tree" the on-device capture would harvest on Android.
 */
export function snapshotShop(state: ShopState, stateId?: string): UIState {
  const nodes: CapturedNode[] = [];
  const screenName = state.screen;
  const push = (n: CapturedNode) => nodes.push(n);

  push({
    nodeId: "root-app-bar",
    role: "appBar",
    text: "PocketQA Demo Shop",
    resourceId: "shop:app-bar",
    testId: "shop-app-bar",
    enabled: true,
    visible: true,
    sensitive: false,
  });

  if (state.screen === "list") {
    PRODUCTS.forEach((p, i) => {
      push({
        nodeId: `product-card-${p.id}`,
        role: "button",
        text: p.name,
        contentDescription: `${p.name}, ₹${p.price}`,
        resourceId: `shop:product/${p.id}`,
        testId: `product-${p.id}`,
        enabled: true,
        visible: true,
        bounds: { x: 16, y: 80 + i * 90, w: 340, h: 80 },
        sensitive: false,
      });
    });
    if (state.cartItems.length > 0) {
      push({
        nodeId: "cart-badge",
        role: "button",
        text: `Cart (${state.cartItems.length})`,
        resourceId: "shop:cart-badge",
        testId: "open-cart",
        enabled: true,
        visible: true,
        bounds: { x: 300, y: 20, w: 80, h: 40 },
        sensitive: false,
      });
    }
  }

  if (state.screen === "detail" && state.selectedProductId) {
    const product = PRODUCTS.find((p) => p.id === state.selectedProductId);
    if (product) {
      push({ nodeId: "detail-title", role: "heading", text: product.name, testId: "detail-title", enabled: true, visible: true, sensitive: false });
      push({ nodeId: "detail-desc", role: "text", text: product.description, testId: "detail-desc", enabled: true, visible: true, sensitive: false });
      push({ nodeId: "detail-price", role: "text", text: `₹${product.price}`, testId: "detail-price", enabled: true, visible: true, sensitive: false });
      push({
        nodeId: "add-to-cart-btn",
        role: "button",
        text: "Add to cart",
        contentDescription: `Add ${product.name} to cart`,
        resourceId: "shop:add-to-cart",
        testId: "add-to-cart",
        enabled: true,
        visible: true,
        bounds: { x: 16, y: 500, w: 340, h: 56 },
        sensitive: false,
      });
      push({
        nodeId: "back-to-list",
        role: "button",
        text: "Back",
        resourceId: "shop:back",
        testId: "back-to-list",
        enabled: true,
        visible: true,
        sensitive: false,
      });
    }
  }

  if (state.screen === "cart") {
    push({ nodeId: "cart-heading", role: "heading", text: "Your cart", testId: "cart-heading", enabled: true, visible: true, sensitive: false });
    const items = state.cartItems.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean) as Product[];
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.price;
      push({
        nodeId: `cart-item-${item.id}`,
        role: "row",
        text: `${item.name} — ₹${item.price}`,
        testId: `cart-item-${item.id}`,
        enabled: true,
        visible: true,
        sensitive: false,
      });
    }
    // Coupon input & apply
    push({
      nodeId: "coupon-input",
      role: "textField",
      text: state.couponInput,
      contentDescription: "Coupon code",
      resourceId: "shop:coupon-input",
      testId: "coupon-input",
      enabled: true,
      visible: true,
      sensitive: false,
    });
    push({
      nodeId: "coupon-apply-btn",
      role: "button",
      text: state.driftEnabled ? "Use coupon" : "Apply coupon",
      contentDescription: "Apply the entered coupon code",
      resourceId: "shop:coupon-apply",
      testId: "apply-coupon",
      enabled: true,
      visible: true,
      sensitive: false,
    });
    if (state.couponApplied) {
      push({
        nodeId: "coupon-applied-badge",
        role: "badge",
        text: `${state.couponApplied} applied`,
        contentDescription: "Coupon successfully applied",
        testId: "coupon-applied",
        enabled: true,
        visible: true,
        sensitive: false,
      });
      const discount = Math.round(subtotal * 0.2);
      push({
        nodeId: "discount-row",
        role: "text",
        text: `Discount: -₹${discount}`,
        testId: "discount-row",
        enabled: true,
        visible: true,
        sensitive: false,
      });
      push({
        nodeId: "total-row",
        role: "text",
        text: `Total: ₹${subtotal - discount}`,
        testId: "total-row",
        enabled: true,
        visible: true,
        sensitive: false,
      });
    } else {
      push({
        nodeId: "total-row",
        role: "text",
        text: `Total: ₹${subtotal}`,
        testId: "total-row",
        enabled: true,
        visible: true,
        sensitive: false,
      });
    }
    if (state.lastError && state.screen === "cart") {
      push({
        nodeId: "coupon-error",
        role: "text",
        text: state.lastError,
        testId: "coupon-error",
        enabled: true,
        visible: true,
        sensitive: false,
      });
    }
    push({
      nodeId: "continue-checkout-btn",
      role: "button",
      text: "Continue to checkout",
      resourceId: "shop:continue-checkout",
      testId: "continue-checkout",
      enabled: state.cartItems.length > 0,
      visible: true,
      sensitive: false,
    });
    // "Coupon details" — the safe untested state Explorer can discover.
    push({
      nodeId: "coupon-details-btn",
      role: "button",
      text: "Coupon details",
      resourceId: "shop:coupon-details",
      testId: "coupon-details",
      enabled: true,
      visible: true,
      sensitive: false,
    });
  }

  if (state.screen === "checkout-loading") {
    push({ nodeId: "checkout-heading", role: "heading", text: "Processing…", testId: "checkout-heading", enabled: true, visible: true, sensitive: false });
    push({ nodeId: "coupon-applied-persist", role: "text", text: state.couponApplied ? `${state.couponApplied} applied` : "No coupon", testId: "coupon-persist", enabled: true, visible: true, sensitive: false });
  }
  if (state.screen === "checkout-failed") {
    push({ nodeId: "checkout-heading", role: "heading", text: "Payment failed", testId: "checkout-heading", enabled: true, visible: true, sensitive: false });
    push({ nodeId: "checkout-error", role: "text", text: state.lastError || "Payment failed", testId: "checkout-error", enabled: true, visible: true, sensitive: false });
    push({ nodeId: "coupon-applied-persist", role: "text", text: state.couponApplied ? `${state.couponApplied} still applied` : "No coupon", testId: "coupon-persist", enabled: true, visible: true, sensitive: false });
    push({
      nodeId: "retry-btn",
      role: "button",
      text: "Retry",
      resourceId: "shop:retry",
      testId: "retry",
      enabled: true,
      visible: true,
      sensitive: false,
    });
  }
  if (state.screen === "checkout-success") {
    push({ nodeId: "checkout-heading", role: "heading", text: "Order placed", testId: "checkout-heading", enabled: true, visible: true, sensitive: false });
    push({ nodeId: "coupon-applied-persist", role: "text", text: state.couponApplied ? `${state.couponApplied} applied` : "No coupon", testId: "coupon-persist", enabled: true, visible: true, sensitive: false });
  }

  const ocrText: string[] = nodes
    .filter((n) => n.visible && n.text)
    .map((n) => n.text!)
    .slice(0, 24);

  const id = stateId ?? `state_${djb2(`${screenName}:${JSON.stringify(nodes)}`)}`;
  return {
    id,
    packageName: state.packageName,
    screenName,
    capturedAt: Date.now(),
    ocrText,
    nodes,
  };
}
