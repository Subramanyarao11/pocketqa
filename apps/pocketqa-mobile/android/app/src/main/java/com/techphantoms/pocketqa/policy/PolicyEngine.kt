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

    /**
     * Packages that are never a legitimate capture target, whatever the user
     * picks. PocketQA itself would capture its own review screens; the launcher,
     * system UI and the settings app are where the guarded actions live and are
     * outside any app-scoped session by definition.
     */
    private val neverTargetable = listOf(
        "com.techphantoms.pocketqa",
        "com.android.systemui",
        "com.android.settings",
        "android",
    )

    /** Manifest key a target uses to declare the fixtures it supports. */
    private val FIXTURES_META_DATA = "pocketqa.fixtures"

    private val neverTargetablePrefixes = listOf(
        "com.google.android.packageinstaller",
        "com.android.packageinstaller",
        "com.android.permissioncontroller",
    )

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

    /**
     * Every app the operator may target, read from the device.
     *
     * This used to be `listOf("…demoshop")` with the display name and fixtures
     * hardcoded, which meant PocketQA could only ever record its own sample app.
     * The allowlist is now the set of launchable installed apps minus the ones
     * that are never a valid target — and the operator's per-session choice is
     * what actually scopes capture. Selecting the target *is* the consent.
     *
     * Fixtures are only meaningful for an app that exposes a reset hook, so they
     * are reported per app rather than assumed.
     */
    fun allowlist(context: android.content.Context): WritableArray {
        val pm = context.packageManager
        val launcherIntent = android.content.Intent(android.content.Intent.ACTION_MAIN)
            .addCategory(android.content.Intent.CATEGORY_LAUNCHER)
        val resolved = pm.queryIntentActivities(launcherIntent, 0)

        val seen = mutableSetOf<String>()
        val apps = mutableListOf<Pair<String, String>>()
        for (info in resolved) {
            val pkg = info.activityInfo?.packageName ?: continue
            if (!isTargetable(pkg) || !seen.add(pkg)) continue
            val label = runCatching { info.loadLabel(pm).toString() }.getOrNull() ?: pkg
            apps += pkg to label
        }
        apps.sortBy { it.second.lowercase() }

        val arr = Arguments.createArray()
        for ((pkg, label) in apps) {
            val map: WritableMap = Arguments.createMap()
            map.putString("packageName", pkg)
            map.putString("displayName", label)
            map.putArray("fixtureIds", fixturesFor(pkg, context))
            arr.pushMap(map)
        }
        return arr
    }

    /**
     * Fixture ids a target app declares for itself.
     *
     * Two earlier versions of this were wrong in the same way. The first
     * hardcoded Demo Shop's three ids for every app. The second probed for a
     * `<scheme>://reset` deep link but *still* returned those same three ids on a
     * hit — so any app with a reset hook would have been offered "coupon-retry",
     * which means nothing to it.
     *
     * Fixtures are app-specific by definition, so the app is the only thing that
     * can name them. A target opts in by declaring them in its manifest:
     *
     *     <meta-data android:name="pocketqa.fixtures"
     *                android:value="reset,coupon-retry,selector-drift" />
     *
     * Anything that does not declare them gets an empty list and PocketQA hides
     * the fixture picker entirely — which is the honest answer for the Calculator
     * as much as for a third-party app.
     */
    private fun fixturesFor(packageName: String, context: android.content.Context): WritableArray {
        val arr = Arguments.createArray()
        val declared = runCatching {
            context.packageManager
                .getApplicationInfo(
                    packageName,
                    android.content.pm.PackageManager.GET_META_DATA,
                )
                .metaData
                ?.getString(FIXTURES_META_DATA)
        }.getOrNull() ?: return arr

        for (id in declared.split(',')) {
            val trimmed = id.trim()
            if (trimmed.isNotEmpty()) arr.pushString(trimmed)
        }
        return arr
    }

    private fun isTargetable(packageName: String): Boolean =
        packageName !in neverTargetable &&
            neverTargetablePrefixes.none { packageName.startsWith(it) }

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

    /**
     * Whether a package may be captured at all.
     *
     * The real scoping is per session: the accessibility service already drops
     * every event whose package is not the session's selected target. This is the
     * standing rule underneath that — the handful of packages that are never a
     * valid target no matter what the operator selects.
     */
    fun inAllowlist(packageName: String?): Boolean =
        packageName != null && isTargetable(packageName)

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
