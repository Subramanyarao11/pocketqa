package com.techphantoms.pocketqa.policy

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * Policy engine — the Kotlin counterpart of `src/domain/policy.ts`.
 *
 * The same rules run on both sides so a UI check cannot be smuggled past a
 * runtime check.  The engine is queried before every action; failures are
 * hard stops (see PRD §12 and Build Spec §11.3 error envelope).
 */
class PolicyEngine {
    private val allowlistedPackages = listOf("com.techphantoms.pocketqa.demoshop")

    private val blockedKeywords = listOf(
        "pay", "checkout complete", "confirm order", "place order",
        "purchase", "buy now", "delete account", "grant permission",
        "allow permission", "accept terms", "send message", "call now",
        "install", "uninstall",
    )

    private val sensitivePatterns = listOf(
        Regex("password", RegexOption.IGNORE_CASE),
        Regex("\\botp\\b", RegexOption.IGNORE_CASE),
        Regex("\\bcvv\\b", RegexOption.IGNORE_CASE),
        Regex("card\\s?number", RegexOption.IGNORE_CASE),
        Regex("\\bpin\\b", RegexOption.IGNORE_CASE),
        Regex("biometric", RegexOption.IGNORE_CASE),
    )

    fun allowlist(): WritableArray {
        val arr = Arguments.createArray()
        for (pkg in allowlistedPackages) {
            val map: WritableMap = Arguments.createMap()
            map.putString("packageName", pkg)
            map.putString("displayName", "PocketQA Demo Shop")
            arr.pushMap(map)
        }
        return arr
    }

    /** True when the label/description hits a blocked-category keyword. */
    fun isBlockedCategory(text: String?): Boolean {
        val t = text?.lowercase() ?: return false
        return blockedKeywords.any { t.contains(it) }
    }

    /** True when the target belongs to a sensitive field category. */
    fun isSensitive(text: String?): Boolean {
        val t = text ?: return false
        return sensitivePatterns.any { it.containsMatchIn(t) }
    }

    fun inAllowlist(packageName: String?): Boolean = packageName in allowlistedPackages
}
