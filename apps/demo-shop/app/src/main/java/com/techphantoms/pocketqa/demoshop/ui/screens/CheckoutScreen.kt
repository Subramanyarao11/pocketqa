package com.techphantoms.pocketqa.demoshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.techphantoms.pocketqa.demoshop.data.Fixtures

@Composable
fun CheckoutScreen(
    total: Double,
    onConfirm: () -> Unit,
    onBack: () -> Unit
) {
    var isProcessing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSuccess by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .testTag("checkout_screen"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (isSuccess) {
            Text(
                text = "Order Confirmed!",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.testTag("success_message")
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onBack,
                modifier = Modifier.testTag("continue_shopping_button")
            ) {
                Text("Continue Shopping")
            }
        } else {
            Text(
                text = "Confirm Order",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.testTag("checkout_title")
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Total: $${String.format("%.2f", total)}",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.testTag("checkout_total")
            )
            Spacer(modifier = Modifier.height(24.dp))

            if (errorMessage != null) {
                Text(
                    text = errorMessage!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("error_message")
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            if (isProcessing) {
                CircularProgressIndicator(
                    modifier = Modifier.testTag("processing_indicator")
                )
            } else {
                Button(
                    onClick = {
                        isProcessing = true
                        errorMessage = null
                        if (Fixtures.shouldSimulateCheckoutError) {
                            isProcessing = false
                            errorMessage = "Payment failed. Please try again."
                            if (Fixtures.shouldSimulateRetry) {
                                Fixtures.shouldSimulateCheckoutError = false
                            }
                        } else {
                            isProcessing = false
                            isSuccess = true
                            onConfirm()
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("confirm_order_button")
                ) {
                    Text("Place Order")
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            TextButton(
                onClick = onBack,
                modifier = Modifier.testTag("back_to_cart_button")
            ) {
                Text("Back to Cart")
            }
        }
    }
}
