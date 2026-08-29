package com.techphantoms.pocketqa.demoshop.data

data class Product(
    val id: String,
    val name: String,
    val price: Double,
    val description: String,
    val imageEmoji: String
)

data class CartItem(
    val product: Product,
    val quantity: Int
)

data class Coupon(
    val code: String,
    val discountPercent: Int
)

object Fixtures {
    val products = listOf(
        Product("1", "Wireless Headphones", 79.99, "Premium noise-cancelling headphones", "🎧"),
        Product("2", "Smart Watch", 199.99, "Fitness tracking smartwatch", "⌚"),
        Product("3", "Phone Case", 29.99, "Durable protective phone case", "📱"),
        Product("4", "USB-C Cable", 12.99, "Fast charging cable, 2m", "🔌"),
        Product("5", "Bluetooth Speaker", 49.99, "Portable waterproof speaker", "🔊"),
    )

    val validCoupon = Coupon("SAVE20", 20)

    var shouldSimulateCheckoutError = false
    var shouldSimulateRetry = false

    fun reset() {
        shouldSimulateCheckoutError = false
        shouldSimulateRetry = false
    }
}
