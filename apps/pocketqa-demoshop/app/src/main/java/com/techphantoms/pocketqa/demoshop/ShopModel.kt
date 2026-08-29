package com.techphantoms.pocketqa.demoshop

/**
 * Deterministic shop state machine — the Kotlin counterpart of
 * `apps/pocketqa-mobile/src/domain/demoShopModel.ts`.  Keeping the two in
 * lockstep is what makes PocketQA's captures deterministic: every reducer
 * transition maps to a stable state the accessibility service will observe.
 *
 * The three fixtures PocketQA calls out (`reset`, `coupon-retry`,
 * `selector-drift`) are supported by [reduce] — the caller passes the fixture
 * name into a `reset` action, and the reducer initialises the world so a
 * scripted replay always reaches the same success screen.
 */
enum class Screen { LIST, DETAIL, CART, CHECKOUT_LOADING, CHECKOUT_FAILED, CHECKOUT_SUCCESS }
enum class Fixture { RESET, COUPON_RETRY, SELECTOR_DRIFT }

data class Product(val id: String, val name: String, val price: Int, val emoji: String, val description: String)

val PRODUCTS = listOf(
    Product("sneakers", "Retro Sneakers", 4200, "\uD83D\uDC5F", "Cushioned trainers with a retro silhouette."),
    Product("tee", "Classic Tee", 899, "\uD83D\uDC55", "Soft cotton crew-neck."),
    Product("cap", "Runner Cap", 649, "\uD83E\uDDE2", "Breathable cap with a curved brim."),
)

const val COUPON_VALID = "SAVE20"

data class ShopState(
    val screen: Screen = Screen.LIST,
    val selectedProductId: String? = null,
    val cartItems: List<String> = emptyList(),
    val couponInput: String = "",
    val couponApplied: String? = null,
    val lastError: String? = null,
    val driftEnabled: Boolean = false,
    val fixture: Fixture = Fixture.RESET,
)

sealed interface ShopAction {
    data class Reset(val fixture: Fixture = Fixture.RESET) : ShopAction
    data class OpenProduct(val id: String) : ShopAction
    data class AddToCart(val id: String) : ShopAction
    data object OpenCart : ShopAction
    data object BackToList : ShopAction
    data class TypeCoupon(val value: String) : ShopAction
    data object ApplyCoupon : ShopAction
    data object ContinueToCheckout : ShopAction
    data object CheckoutTick : ShopAction
    data object RetryCheckout : ShopAction
}

fun reduce(state: ShopState, action: ShopAction): ShopState = when (action) {
    is ShopAction.Reset -> ShopState(fixture = action.fixture, driftEnabled = action.fixture == Fixture.SELECTOR_DRIFT)
    is ShopAction.OpenProduct -> state.copy(screen = Screen.DETAIL, selectedProductId = action.id)
    is ShopAction.AddToCart ->
        if (action.id in state.cartItems) state
        else state.copy(cartItems = state.cartItems + action.id)
    ShopAction.OpenCart -> state.copy(screen = Screen.CART)
    ShopAction.BackToList -> state.copy(screen = Screen.LIST, selectedProductId = null)
    is ShopAction.TypeCoupon -> state.copy(couponInput = action.value)
    ShopAction.ApplyCoupon ->
        if (state.couponInput.trim().uppercase() == COUPON_VALID)
            state.copy(couponApplied = COUPON_VALID, lastError = null)
        else state.copy(couponApplied = null, lastError = "Coupon not recognised")
    ShopAction.ContinueToCheckout -> state.copy(screen = Screen.CHECKOUT_LOADING, lastError = null)
    // Deterministic canonical trace: first checkout attempt fails, retry succeeds.
    ShopAction.CheckoutTick ->
        if (state.screen == Screen.CHECKOUT_LOADING && state.lastError == null)
            state.copy(screen = Screen.CHECKOUT_FAILED, lastError = "Simulated payment gateway timeout")
        else state
    ShopAction.RetryCheckout -> state.copy(screen = Screen.CHECKOUT_SUCCESS, lastError = null)
}
