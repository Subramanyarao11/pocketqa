package com.techphantoms.pocketqa.capture

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.techphantoms.pocketqa.compiler.CompileCoordinator
import com.techphantoms.pocketqa.policy.PolicyEngine
import com.techphantoms.pocketqa.storage.PocketQaRepository
import java.util.concurrent.atomic.AtomicReference

/**
 * Coordinates a capture session.  Owns the session lifecycle, hands raw
 * accessibility events over to the redactor + normalizer, and persists
 * normalized events + UIState snapshots into Room.
 *
 * The React Native façade never sees raw AccessibilityNodeInfo — only
 * schema-validated, redacted domain records.
 */
class CaptureCoordinator(
    private val ctx: ReactApplicationContext,
    private val repo: PocketQaRepository,
    private val policy: PolicyEngine,
) {
    companion object {
        private val service = AtomicReference<PocketQaAccessibilityService?>(null)
        private val activePackage = AtomicReference<String?>(null)

        fun attach(s: PocketQaAccessibilityService) { service.set(s) }
        fun detach(s: PocketQaAccessibilityService) { service.compareAndSet(s, null) }
        fun activePackage(): String? = activePackage.get()

        fun onEvent(event: AccessibilityEvent, root: AccessibilityNodeInfo?) {
            // Placeholder: normalize + debounce + snapshot semantic states here.
        }
    }

    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(intent)
    }

    fun start(input: ReadableMap, promise: Promise) {
        val intentId = input.getString("intentId") ?: return promise.reject("ARG", "intentId required")
        val fixture = if (input.hasKey("fixture")) input.getString("fixture") else null
        val session = repo.startSession(intentId, fixture)
        if (!policy.allowlist().any { it.getString("packageName") == session.packageName }) {
            return promise.reject("POLICY_DENIED", "package not allowlisted")
        }
        activePackage.set(session.packageName)
        launchDemoShop(session.packageName)
        promise.resolve(mapOf("sessionId" to session.id))
    }

    fun simulate(sessionId: String, evt: ReadableMap) {
        // Test/demo helper — the release build wires real accessibility events instead.
        repo.appendSimulatedEvent(sessionId, evt)
    }

    fun pause(sessionId: String) { repo.pauseSession(sessionId) }
    fun resume(sessionId: String) { repo.resumeSession(sessionId) }

    fun finish(sessionId: String, compiler: CompileCoordinator, promise: Promise) {
        val jobId = compiler.compile(sessionId)
        activePackage.set(null)
        promise.resolve(mapOf("compileJobId" to jobId))
    }

    fun cancel(sessionId: String, deleteArtifacts: Boolean) {
        activePackage.set(null)
        repo.cancelSession(sessionId, deleteArtifacts)
    }

    private fun launchDemoShop(pkg: String) {
        val launch = ctx.packageManager.getLaunchIntentForPackage(pkg) ?: return
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        ctx.startActivity(launch)
    }
}
