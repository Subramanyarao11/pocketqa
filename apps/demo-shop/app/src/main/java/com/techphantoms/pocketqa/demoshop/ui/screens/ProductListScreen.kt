package com.techphantoms.pocketqa.demoshop.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.techphantoms.pocketqa.demoshop.data.Fixtures
import com.techphantoms.pocketqa.demoshop.data.Product

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductListScreen(
    onAddToCart: (Product) -> Unit,
    onNavigateToCart: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Demo Shop") },
                actions = {
                    TextButton(
                        onClick = onNavigateToCart,
                        modifier = Modifier.testTag("cart_button")
                    ) {
                        Text("Cart")
                    }
                }
            )
        },
        modifier = Modifier.testTag("product_list_screen")
    ) { padding ->
        LazyColumn(
            contentPadding = padding,
            modifier = Modifier.testTag("product_list")
        ) {
            items(Fixtures.products) { product ->
                ProductCard(product = product, onAddToCart = { onAddToCart(product) })
            }
        }
    }
}

@Composable
private fun ProductCard(product: Product, onAddToCart: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .testTag("product_card_${product.id}")
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = product.imageEmoji,
                fontSize = 40.sp,
                modifier = Modifier.testTag("product_image_${product.id}")
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = product.name,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.testTag("product_name_${product.id}")
                )
                Text(
                    text = "$${product.price}",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.testTag("product_price_${product.id}")
                )
            }
            Button(
                onClick = onAddToCart,
                modifier = Modifier.testTag("add_to_cart_${product.id}")
            ) {
                Text("Add")
            }
        }
    }
}
