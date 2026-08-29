package com.techphantoms.pocketqa.demoshop

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

/**
 * Deterministic Demo Shop target app (PRD §16).
 *
 * The whole activity is a single Compose tree driven by [ShopState]. Every
 * interactive element carries a stable `testTag` so the PocketQA compiler can
 * pick the `testId` strategy at 0.98 confidence.  There is no networking; the
 * "payment gateway" is deliberate two-step failure→retry so scripted replays
 * are always green on the second checkout.
 *
 * The `pocketqa-demo://fixture/<name>` deep link resets the shop before a
 * scripted replay so the ReplayExecutor's fresh-fixture guarantee holds.
 */
class ShopActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme { ShopRoot(initialFixtureFromIntent(intent)) }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Recreate to force a state reset from the new deep-link fixture.
        recreate()
    }

    private fun initialFixtureFromIntent(intent: Intent?): Fixture {
        val name = intent?.data?.pathSegments?.firstOrNull() ?: return Fixture.RESET
        return when (name) {
            "coupon-retry" -> Fixture.COUPON_RETRY
            "selector-drift" -> Fixture.SELECTOR_DRIFT
            else -> Fixture.RESET
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopRoot(initialFixture: Fixture) {
    var state by remember { mutableStateOf(reduce(ShopState(), ShopAction.Reset(initialFixture))) }
    fun dispatch(a: ShopAction) { state = reduce(state, a) }

    // The checkout screen ticks itself once so the deterministic failure→retry
    // sequence works regardless of user pace.
    LaunchedEffect(state.screen) {
        if (state.screen == Screen.CHECKOUT_LOADING) {
            Handler(Looper.getMainLooper()).postDelayed({ dispatch(ShopAction.CheckoutTick) }, 400)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("PocketQA Demo Shop", modifier = Modifier.testTag("shop-app-bar")) },
                colors = TopAppBarDefaults.topAppBarColors(),
            )
        },
    ) { inner ->
        Column(
            Modifier
                .padding(inner)
                .fillMaxSize()
                .background(Color(0xFFF7FAFC))
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            when (state.screen) {
                Screen.LIST -> ListScreen(state, ::dispatch)
                Screen.DETAIL -> DetailScreen(state, ::dispatch)
                Screen.CART -> CartScreen(state, ::dispatch)
                Screen.CHECKOUT_LOADING -> CenterText("Processing…", tag = "checkout-heading")
                Screen.CHECKOUT_FAILED -> CheckoutFailedScreen(state, ::dispatch)
                Screen.CHECKOUT_SUCCESS -> CheckoutSuccessScreen(state)
            }
        }
    }
}

@Composable private fun CenterText(text: String, tag: String) {
    Box(Modifier.fillMaxWidth().padding(24.dp)) {
        Text(text, modifier = Modifier.testTag(tag))
    }
}

@Composable
private fun ListScreen(state: ShopState, dispatch: (ShopAction) -> Unit) {
    for (p in PRODUCTS) {
        Button(
            onClick = { dispatch(ShopAction.OpenProduct(p.id)) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
                .testTag("product-${p.id}")
                .semantics { contentDescription = "${p.name}, ₹${p.price}" },
        ) { Text("${p.emoji} ${p.name} — ₹${p.price}") }
    }
    if (state.cartItems.isNotEmpty()) {
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = { dispatch(ShopAction.OpenCart) },
            modifier = Modifier.testTag("open-cart"),
        ) { Text("Cart (${state.cartItems.size})") }
    }
}

@Composable
private fun DetailScreen(state: ShopState, dispatch: (ShopAction) -> Unit) {
    val product = PRODUCTS.first { it.id == state.selectedProductId }
    Text(product.name, modifier = Modifier.testTag("detail-title"), fontWeight = FontWeight.SemiBold)
    Text(product.description, modifier = Modifier.testTag("detail-desc"))
    Text("₹${product.price}", modifier = Modifier.testTag("detail-price"))
    Spacer(Modifier.height(16.dp))
    Button(
        onClick = { dispatch(ShopAction.AddToCart(product.id)) },
        modifier = Modifier
            .fillMaxWidth()
            .testTag("add-to-cart")
            .semantics { contentDescription = "Add ${product.name} to cart" },
    ) { Text("Add to cart") }
    Spacer(Modifier.height(8.dp))
    TextButton(
        onClick = { dispatch(ShopAction.BackToList) },
        modifier = Modifier.testTag("back-to-list"),
    ) { Text("Back") }
}

@Composable
private fun CartScreen(state: ShopState, dispatch: (ShopAction) -> Unit) {
    Text("Your cart", fontWeight = FontWeight.SemiBold, modifier = Modifier.testTag("cart-heading"))
    val items = state.cartItems.mapNotNull { id -> PRODUCTS.firstOrNull { it.id == id } }
    var subtotal = 0
    for (item in items) {
        subtotal += item.price
        Text("${item.name} — ₹${item.price}",
            modifier = Modifier.testTag("cart-item-${item.id}"))
    }
    OutlinedTextField(
        value = state.couponInput,
        onValueChange = { dispatch(ShopAction.TypeCoupon(it)) },
        label = { Text("Coupon code") },
        modifier = Modifier
            .fillMaxWidth()
            .testTag("coupon-input")
            .semantics { contentDescription = "Coupon code" },
    )
    Button(
        onClick = { dispatch(ShopAction.ApplyCoupon) },
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .testTag("apply-coupon")
            .semantics { contentDescription = "Apply the entered coupon code" },
    ) { Text(if (state.driftEnabled) "Use coupon" else "Apply coupon") }
    if (state.couponApplied != null) {
        val discount = (subtotal * 0.2).toInt()
        Text("${state.couponApplied} applied",
            modifier = Modifier.testTag("coupon-applied"))
        Text("Discount: -₹${discount}", modifier = Modifier.testTag("discount-row"))
        Text("Total: ₹${subtotal - discount}", modifier = Modifier.testTag("total-row"))
    } else {
        Text("Total: ₹${subtotal}", modifier = Modifier.testTag("total-row"))
    }
    state.lastError?.let {
        Text(it, modifier = Modifier.testTag("coupon-error"), color = Color(0xFFFF667A))
    }
    Button(
        enabled = state.cartItems.isNotEmpty(),
        onClick = { dispatch(ShopAction.ContinueToCheckout) },
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .testTag("continue-checkout"),
    ) { Text("Continue to checkout") }
    TextButton(
        onClick = { /* explorer target only */ },
        modifier = Modifier.testTag("coupon-details"),
    ) { Text("Coupon details") }
}

@Composable
private fun CheckoutFailedScreen(state: ShopState, dispatch: (ShopAction) -> Unit) {
    Text("Payment failed", modifier = Modifier.testTag("checkout-heading"), fontWeight = FontWeight.SemiBold)
    Text(state.lastError ?: "Payment failed", modifier = Modifier.testTag("checkout-error"))
    Text(
        state.couponApplied?.let { "$it still applied" } ?: "No coupon",
        modifier = Modifier.testTag("coupon-persist"),
    )
    Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = { dispatch(ShopAction.RetryCheckout) },
            modifier = Modifier.testTag("retry"),
        ) { Text("Retry") }
    }
}

@Composable
private fun CheckoutSuccessScreen(state: ShopState) {
    Text("Order placed", modifier = Modifier.testTag("checkout-heading"), fontWeight = FontWeight.SemiBold)
    Text(
        state.couponApplied?.let { "$it applied" } ?: "No coupon",
        modifier = Modifier.testTag("coupon-persist"),
    )
}

@Preview @Composable private fun ListPreview() { ShopRoot(Fixture.COUPON_RETRY) }
