package com.techphantoms.pocketqa.demoshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.techphantoms.pocketqa.demoshop.data.CartItem
import com.techphantoms.pocketqa.demoshop.data.Fixtures

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(
    cartItems: List<CartItem>,
    onRemoveItem: (String) -> Unit,
    onApplyCoupon: (String) -> Unit,
    discount: Int,
    onCheckout: () -> Unit,
    onBack: () -> Unit
) {
    var couponCode by remember { mutableStateOf("") }
    val subtotal = cartItems.sumOf { it.product.price * it.quantity }
    val discountAmount = subtotal * discount / 100
    val total = subtotal - discountAmount

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Cart") },
                navigationIcon = {
                    TextButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("back_button")
                    ) {
                        Text("Back")
                    }
                }
            )
        },
        modifier = Modifier.testTag("cart_screen")
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .testTag("cart_list")
            ) {
                items(cartItems) { item ->
                    CartItemRow(item = item, onRemove = { onRemoveItem(item.product.id) })
                }
            }

            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = couponCode,
                        onValueChange = { couponCode = it },
                        label = { Text("Coupon Code") },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("coupon_input"),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onApplyCoupon(couponCode) },
                        modifier = Modifier.testTag("apply_coupon_button")
                    ) {
                        // Confirming on the control that was pressed, not only in
                        // the totals further down the screen.
                        Text(if (discount > 0) "Applied" else "Apply")
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Subtotal: $${String.format("%.2f", subtotal)}",
                    modifier = Modifier.testTag("subtotal_text")
                )
                if (discount > 0) {
                    Text(
                        text = "Discount ($discount%): -$${String.format("%.2f", discountAmount)}",
                        modifier = Modifier.testTag("discount_text")
                    )
                }
                Text(
                    text = "Total: $${String.format("%.2f", total)}",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.testTag("total_text")
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = onCheckout,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("checkout_button"),
                    enabled = cartItems.isNotEmpty()
                ) {
                    Text("Checkout")
                }
            }
        }
    }
}

@Composable
private fun CartItemRow(item: CartItem, onRemove: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .testTag("cart_item_${item.product.id}"),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = item.product.name, style = MaterialTheme.typography.bodyLarge)
            Text(text = "Qty: ${item.quantity} × $${item.product.price}")
        }
        TextButton(
            onClick = onRemove,
            modifier = Modifier.testTag("remove_item_${item.product.id}")
        ) {
            Text("Remove")
        }
    }
}
