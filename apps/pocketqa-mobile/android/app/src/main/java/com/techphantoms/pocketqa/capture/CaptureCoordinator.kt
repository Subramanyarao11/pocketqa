package com.techphantoms.pocketqa.capture

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
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
        private val activeSession = AtomicReference<String?>(null)
        @Volatile private var stateSink: ((UiTreeCapture.Snapshot) -> Unit)? = null

        fun attach(s: PocketQaAccessibilityService) { service.set(s) }
        fun detach(s: PocketQaAccessibilityService) { service.compareAndSet(s, null) }
        fun activePackage(): String? = activePackage.get()

        fun onEvent(event: AccessibilityEvent, root: AccessibilityNodeInfo?) {
            // Reserved for future micro-classification. The debounced snapshot
            // from [onStableState] carries the authoritative UI state.
        }

        fun onStableState(snapshot: UiTreeCapture.Snapshot) {
            stateSink?.invoke(snapshot)
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
        if (!policy.inAllowlist(session.packageName)) {
            return promise.reject("POLICY_DENIED", "package not allowlisted")
        }
        activePackage.set(session.packageName)
        activeSession.set(session.id)
        // Sink stable states from the accessibility service into Room and echo
        // a CAPTURE_PROGRESS ping so the JS layer sees liveness.
        stateSink = { snapshot ->
            repo.persistUIState(
                id = snapshot.stateId,
                packageName = session.packageName,
                screenName = extractScreenFromPayload(snapshot.payload),
                payload = snapshot.payload,
            )
            emitCaptureProgress(session.id, session.packageName)
        }
        launchDemoShop(session.packageName)
        val out = com.facebook.react.bridge.Arguments.createMap()
        out.putString("sessionId", session.id)
        promise.resolve(out)
    }

    private fun extractScreenFromPayload(payload: String): String = try {
        val obj = com.techphantoms.pocketqa.storage.JsonBridge.json
            .parseToJsonElement(payload) as? kotlinx.serialization.json.JsonObject
        obj?.get("screenName")?.toString()?.trim('"') ?: "screen"
    } catch (_: Throwable) { "screen" }

    private fun emitCaptureProgress(sessionId: String, packageName: String) {
        val payload = com.facebook.react.bridge.Arguments.createMap()
        payload.putString("sessionId", sessionId)
        payload.putString("state", "recording")
        payload.putInt("stepCount", 0)
        payload.putInt("elapsedMs", 0)
        payload.putString("packageName", packageName)
        emitEvent("CAPTURE_PROGRESS", payload)
    }

    fun simulate(sessionId: String, evt: ReadableMap) {
        // Test/demo helper — the release build wires real accessibility events instead.
        val label = if (evt.hasKey("label")) evt.getString("label") ?: "" else ""
        val decision = policy.evaluateLabel(label, activePackage.get())
        if (decision is PolicyEngine.Decision.HardStop) {
            emitEvent("CAPTURE_HARD_STOP", policy.toHardStopPayload(sessionId, decision))
            return
        }
        repo.appendSimulatedEvent(sessionId, evt)
    }

    private fun emitEvent(type: String, payload: com.facebook.react.bridge.WritableMap) {
        val envelope = com.facebook.react.bridge.Arguments.createMap()
        envelope.putString("type", type)
        envelope.putMap("payload", payload)
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("PocketQaEvent", envelope)
    }

    fun pause(sessionId: String) { repo.pauseSession(sessionId) }
    fun resume(sessionId: String) { repo.resumeSession(sessionId) }

    fun finish(sessionId: String, compiler: CompileCoordinator, promise: Promise) {
        val jobId = compiler.compile(sessionId)
        activePackage.set(null)
        activeSession.set(null)
        stateSink = null
        val out = com.facebook.react.bridge.Arguments.createMap()
        out.putString("compileJobId", jobId)
        promise.resolve(out)
    }

    fun cancel(sessionId: String, deleteArtifacts: Boolean) {
        activePackage.set(null)
        activeSession.set(null)
        stateSink = null
        repo.cancelSession(sessionId, deleteArtifacts)
    }

    private fun launchDemoShop(pkg: String) {
        val launch = ctx.packageManager.getLaunchIntentForPackage(pkg) ?: return
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        ctx.startActivity(launch)
    }
}
