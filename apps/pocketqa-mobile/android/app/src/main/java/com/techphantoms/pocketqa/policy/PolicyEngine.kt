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
            val fixtures = Arguments.createArray()
            fixtures.pushString("reset")
            fixtures.pushString("coupon-retry")
            fixtures.pushString("selector-drift")
            map.putArray("fixtureIds", fixtures)
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

    /** Structured decision — mirrors PolicyDecision in src/domain/policy.ts. */
    sealed class Decision {
        object Allowed : Decision()
        data class HardStop(val code: String, val category: Category, val message: String) : Decision()
    }

    enum class Category { PACKAGE, SENSITIVE, BLOCKED, AMBIGUOUS, TARGET_MISSING, BUDGET, USER }

    fun evaluateLabel(label: String, activePackage: String?): Decision {
        if (activePackage != null && !inAllowlist(activePackage)) {
            return Decision.HardStop("PACKAGE_BOUNDARY_VIOLATION", Category.PACKAGE,
                "Active package $activePackage is not in the allowlist.")
        }
        if (isBlockedCategory(label)) {
            return Decision.HardStop("BLOCKED_CATEGORY", Category.BLOCKED,
                "\"$label\" matches a blocked action category.")
        }
        if (isSensitive(label)) {
            return Decision.HardStop("SENSITIVE_TARGET_BLOCKED", Category.SENSITIVE,
                "Sensitive input target — hard stop.")
        }
        return Decision.Allowed
    }

    /** Format a Decision as the wire-safe HardStop payload consumed by JS. */
    fun toHardStopPayload(operationId: String, decision: Decision.HardStop): WritableMap {
        val map = Arguments.createMap()
        map.putString("operationId", operationId)
        map.putString("code", decision.code)
        map.putString("category", when (decision.category) {
            Category.PACKAGE -> "package"
            Category.SENSITIVE -> "sensitive"
            Category.BLOCKED -> "blocked"
            Category.AMBIGUOUS -> "ambiguous"
            Category.TARGET_MISSING -> "target-missing"
            Category.BUDGET -> "budget"
            Category.USER -> "user"
        })
        map.putString("message", decision.message)
        return map
    }
}
