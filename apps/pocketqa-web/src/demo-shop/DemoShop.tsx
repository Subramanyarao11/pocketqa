import { useEffect, useMemo, useRef } from "react";
import {
  PRODUCTS,
  reduceShop,
  snapshotShop,
  type ShopAction,
  type ShopState,
} from "./model";
import type { CaptureEvent, UIState } from "../lib/schemas";
import { nextId } from "../lib/ids";

/**
 * Renders the Demo Shop and — when in "capture" mode — records every user
 * interaction into normalized PocketQA events + before/after UIStates.
 */
export interface DemoShopProps {
  state: ShopState;
  dispatch: (a: ShopAction) => void;
  onCaptureEvent?: (event: CaptureEvent, before: UIState, after: UIState) => void;
  interactive?: boolean;
  highlightNodeId?: string | null;
}

export function DemoShop({
  state,
  dispatch,
  onCaptureEvent,
  interactive = true,
  highlightNodeId,
}: DemoShopProps) {
  const prevStateRef = useRef<UIState | null>(null);

  const currentUiState = useMemo(() => snapshotShop(state), [state]);

  useEffect(() => {
    prevStateRef.current = currentUiState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick the checkout state machine deterministically.
  useEffect(() => {
    if (state.screen === "checkout-loading") {
      const t = setTimeout(() => dispatch({ type: "checkoutTick" }), 900);
      return () => clearTimeout(t);
    }
  }, [state.screen, dispatch]);

  function performAndCapture(
    action: ShopAction,
    normalized: { kind: CaptureEvent["action"]; nodeId?: string; input?: string; label: string }
  ) {
    const before = snapshotShop(state);
    const after = snapshotShop(reduceShop(state, action));
    dispatch(action);
    if (onCaptureEvent) {
      onCaptureEvent(
        {
          id: nextId("evt"),
          at: Date.now(),
          action: normalized.kind,
          nodeId: normalized.nodeId,
          input: normalized.input,
          beforeStateId: before.id,
          afterStateId: after.id,
        },
        before,
        after
      );
    }
    prevStateRef.current = after;
  }

  const disabled = !interactive;

  return (
    <div className="shop-root" data-package={state.packageName}>
      <div className="shop-header">
        <div className="row-between">
          <span className="eyebrow">Demo Shop · {state.fixture}</span>
          {state.cartItems.length > 0 && state.screen === "list" && (
            <button
              className="btn small"
              disabled={disabled}
              onClick={() => performAndCapture(
                { type: "openCart" },
                { kind: "tap", nodeId: "cart-badge", label: "Open cart" }
              )}
              data-testid="open-cart"
            >
              Cart ({state.cartItems.length}) →
            </button>
          )}
        </div>
      </div>

      {state.screen === "list" && (
        <>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Trending</div>
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              className="shop-product"
              disabled={disabled}
              data-testid={`product-${p.id}`}
              onClick={() => performAndCapture(
                { type: "openProduct", productId: p.id },
                { kind: "tap", nodeId: `product-card-${p.id}`, label: `Open ${p.name}` }
              )}
              style={outlineIf(highlightNodeId === `product-card-${p.id}`)}
            >
              <div className="thumb" style={{ background: "#122029" }}>{p.emoji}</div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: "var(--text-mid)", fontSize: 12 }}>{p.description}</div>
              </div>
              <div style={{ fontWeight: 700 }}>₹{p.price}</div>
            </button>
          ))}
        </>
      )}

      {state.screen === "detail" && state.selectedProductId && (() => {
        const product = PRODUCTS.find((p) => p.id === state.selectedProductId)!;
        return (
          <div>
            <button
              className="btn small ghost"
              disabled={disabled}
              onClick={() => performAndCapture(
                { type: "backToList" },
                { kind: "tap", nodeId: "back-to-list", label: "Back to list" }
              )}
              data-testid="back-to-list"
            >
              ← Back
            </button>
            <div style={{ fontSize: 44, textAlign: "center", padding: 20 }}>{product.emoji}</div>
            <div className="h1" data-testid="detail-title">{product.name}</div>
            <div className="p-dim" style={{ marginBottom: 10 }} data-testid="detail-desc">{product.description}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }} data-testid="detail-price">₹{product.price}</div>
            <div style={{ height: 20 }} />
            <button
              className="btn primary block"
              disabled={disabled}
              data-testid="add-to-cart"
              style={outlineIf(highlightNodeId === "add-to-cart-btn")}
              onClick={() => {
                // Compose add-then-open flow so PocketQA captures one meaningful transition.
                performAndCapture(
                  { type: "addToCart", productId: product.id },
                  { kind: "tap", nodeId: "add-to-cart-btn", label: `Add ${product.name} to cart` }
                );
              }}
            >
              Add to cart
            </button>
            {state.cartItems.includes(product.id) && (
              <button
                className="btn block ghost"
                disabled={disabled}
                style={{ marginTop: 8 }}
                data-testid="open-cart-from-detail"
                onClick={() => performAndCapture(
                  { type: "openCart" },
                  { kind: "tap", nodeId: "cart-badge", label: "Open cart" }
                )}
              >
                Go to cart ({state.cartItems.length}) →
              </button>
            )}
          </div>
        );
      })()}

      {state.screen === "cart" && (
        <div>
          <div className="h1" data-testid="cart-heading">Your cart</div>
          {state.cartItems.length === 0 && <div className="p-dim">Cart is empty.</div>}
          {state.cartItems.map((id) => {
            const p = PRODUCTS.find((x) => x.id === id)!;
            return (
              <div key={id} className="shop-total" data-testid={`cart-item-${id}`}>
                <span>{p.name}</span>
                <span>₹{p.price}</span>
              </div>
            );
          })}
          <hr className="sep" />
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input"
              placeholder="Enter coupon code"
              value={state.couponInput}
              disabled={disabled}
              data-testid="coupon-input"
              style={outlineIf(highlightNodeId === "coupon-input")}
              onChange={(e) => performAndCapture(
                { type: "typeCoupon", value: e.target.value },
                { kind: "typeText", nodeId: "coupon-input", input: e.target.value, label: `Type coupon "${e.target.value}"` }
              )}
            />
            <button
              className="btn primary"
              disabled={disabled}
              data-testid="apply-coupon"
              style={outlineIf(highlightNodeId === "coupon-apply-btn")}
              onClick={() => performAndCapture(
                { type: "applyCoupon" },
                { kind: "tap", nodeId: "coupon-apply-btn", label: state.driftEnabled ? "Tap Use coupon" : "Tap Apply coupon" }
              )}
            >
              {state.driftEnabled ? "Use" : "Apply"}
            </button>
          </div>
          {state.couponApplied && (
            <div className="pill lime" style={{ marginTop: 8 }} data-testid="coupon-applied">
              {state.couponApplied} applied
            </div>
          )}
          {state.lastError && !state.couponApplied && (
            <div className="pill amber" style={{ marginTop: 8 }} data-testid="coupon-error">
              {state.lastError}
            </div>
          )}
          {(() => {
            const subtotal = state.cartItems.reduce((sum, id) => {
              const p = PRODUCTS.find((x) => x.id === id);
              return sum + (p?.price ?? 0);
            }, 0);
            const discount = state.couponApplied ? Math.round(subtotal * 0.2) : 0;
            return (
              <>
                <div className="shop-total"><span>Subtotal</span><span>₹{subtotal}</span></div>
                {discount > 0 && (
                  <div className="shop-total" data-testid="discount-row" style={{ color: "var(--lime)" }}>
                    <span>Discount</span><span>-₹{discount}</span>
                  </div>
                )}
                <div className="shop-total grand" data-testid="total-row"><span>Total</span><span>₹{subtotal - discount}</span></div>
              </>
            );
          })()}
          <button
            className="btn primary block"
            disabled={disabled || state.cartItems.length === 0}
            style={{ marginTop: 12 }}
            data-testid="continue-checkout"
            onClick={() => performAndCapture(
              { type: "continueToCheckout" },
              { kind: "tap", nodeId: "continue-checkout-btn", label: "Continue to checkout" }
            )}
          >
            Continue to checkout
          </button>
          <button
            className="btn block ghost"
            disabled={disabled}
            style={{ marginTop: 8 }}
            data-testid="coupon-details"
            onClick={() => performAndCapture(
              { type: "focusNode", nodeId: "coupon-details-btn" },
              { kind: "tap", nodeId: "coupon-details-btn", label: "Open coupon details" }
            )}
          >
            Coupon details
          </button>
        </div>
      )}

      {state.screen === "checkout-loading" && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>⏳</div>
          <div className="h1" data-testid="checkout-heading">Processing…</div>
          <div className="p-dim" data-testid="coupon-persist">
            {state.couponApplied ? `${state.couponApplied} applied` : "No coupon"}
          </div>
        </div>
      )}
      {state.screen === "checkout-failed" && (
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 36, textAlign: "center" }}>⚠️</div>
          <div className="h1" data-testid="checkout-heading">Payment failed</div>
          <div className="pill amber" data-testid="checkout-error" style={{ marginBottom: 12 }}>
            {state.lastError || "Payment failed"}
          </div>
          <div className="p-dim" data-testid="coupon-persist" style={{ marginBottom: 20 }}>
            {state.couponApplied ? `${state.couponApplied} still applied on retry.` : "No coupon"}
          </div>
          <button
            className="btn primary block"
            disabled={disabled}
            data-testid="retry"
            style={outlineIf(highlightNodeId === "retry-btn")}
            onClick={() => performAndCapture(
              { type: "retryCheckout" },
              { kind: "tap", nodeId: "retry-btn", label: "Tap Retry" }
            )}
          >
            Retry
          </button>
        </div>
      )}
      {state.screen === "checkout-success" && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>✅</div>
          <div className="h1" data-testid="checkout-heading">Order placed</div>
          <div className="p-dim" data-testid="coupon-persist">
            {state.couponApplied ? `${state.couponApplied} applied — order successful.` : "No coupon"}
          </div>
        </div>
      )}
    </div>
  );
}

function outlineIf(active: boolean): React.CSSProperties {
  return active
    ? { outline: "2px solid var(--lime)", outlineOffset: 2, boxShadow: "0 0 12px rgba(198,242,78,0.35)" }
    : {};
}
