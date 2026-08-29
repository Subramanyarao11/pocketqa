package com.techphantoms.pocketqa.demoshop

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.techphantoms.pocketqa.demoshop.data.CartItem
import com.techphantoms.pocketqa.demoshop.data.Fixtures
import com.techphantoms.pocketqa.demoshop.ui.screens.CartScreen
import com.techphantoms.pocketqa.demoshop.ui.screens.CheckoutScreen
import com.techphantoms.pocketqa.demoshop.ui.screens.ProductListScreen
import com.techphantoms.pocketqa.demoshop.ui.theme.DemoShopTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        setContent {
            DemoShopTheme {
                DemoShopApp()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        if (intent?.data?.host == "reset") {
            Fixtures.reset()
        }
    }
}

@Composable
fun DemoShopApp() {
    val navController = rememberNavController()
    var cartItems by remember { mutableStateOf(listOf<CartItem>()) }
    var discount by remember { mutableIntStateOf(0) }

    NavHost(navController = navController, startDestination = "products") {
        composable("products") {
            ProductListScreen(
                onAddToCart = { product ->
                    val existing = cartItems.find { it.product.id == product.id }
                    cartItems = if (existing != null) {
                        cartItems.map {
                            if (it.product.id == product.id) it.copy(quantity = it.quantity + 1)
                            else it
                        }
                    } else {
                        cartItems + CartItem(product, 1)
                    }
                },
                onNavigateToCart = { navController.navigate("cart") }
            )
        }
        composable("cart") {
            CartScreen(
                cartItems = cartItems,
                onRemoveItem = { id -> cartItems = cartItems.filter { it.product.id != id } },
                onApplyCoupon = { code ->
                    if (code.equals(Fixtures.validCoupon.code, ignoreCase = true)) {
                        discount = Fixtures.validCoupon.discountPercent
                    }
                },
                discount = discount,
                onCheckout = { navController.navigate("checkout") },
                onBack = { navController.popBackStack() }
            )
        }
        composable("checkout") {
            val subtotal = cartItems.sumOf { it.product.price * it.quantity }
            val total = subtotal - (subtotal * discount / 100)
            CheckoutScreen(
                total = total,
                onConfirm = {
                    cartItems = emptyList()
                    discount = 0
                },
                onBack = { navController.popBackStack() }
            )
        }
    }
}
