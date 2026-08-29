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

        /**
         * Buffer of pending raw events since the last stable state. Each
         * incoming AccessibilityEvent is classified into a normalised
         * `CaptureEvent`; when the next stable state arrives we flush the
         * buffer with `beforeStateId` = previous stable, `afterStateId` = new.
         */
        private val pendingEvents = java.util.concurrent.ConcurrentLinkedQueue<PendingEvent>()
        @Volatile private var lastStableStateId: String? = null

        data class PendingEvent(
            val action: String,
            val label: String,
            val nodeId: String?,
            val input: String?,
            val at: Long,
        )

        fun onEvent(event: AccessibilityEvent, root: AccessibilityNodeInfo?) {
            val classified = classify(event, root) ?: return
            pendingEvents += classified
        }

        private fun classify(event: AccessibilityEvent, root: AccessibilityNodeInfo?): PendingEvent? {
            val src = event.source
            val text = src?.text?.toString() ?: event.text?.joinToString(" ")?.takeIf { it.isNotBlank() }
            val cd = src?.contentDescription?.toString()
            val label = text ?: cd ?: "Unknown target"
            val nodeId = pathIdFor(root, src)
            return when (event.eventType) {
                AccessibilityEvent.TYPE_VIEW_CLICKED -> PendingEvent(
                    action = "tap", label = label, nodeId = nodeId, input = null,
                    at = System.currentTimeMillis(),
                )
                AccessibilityEvent.TYPE_VIEW_LONG_CLICKED -> PendingEvent(
                    action = "longPress", label = label, nodeId = nodeId, input = null,
                    at = System.currentTimeMillis(),
                )
                AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED -> PendingEvent(
                    action = "typeText", label = label, nodeId = nodeId,
                    input = src?.text?.toString() ?: event.text?.joinToString(),
                    at = System.currentTimeMillis(),
                )
                else -> null
            }
        }

        /**
         * Locate the tree path ID assigned by [UiTreeCapture] for a given
         * `AccessibilityNodeInfo` — matches by equality to preserve stability.
         */
        private fun pathIdFor(
            root: AccessibilityNodeInfo?,
            target: AccessibilityNodeInfo?,
        ): String? {
            if (root == null || target == null) return null
            return searchPath(root, target, "n")
        }

        private fun searchPath(
            node: AccessibilityNodeInfo,
            target: AccessibilityNodeInfo,
            path: String,
        ): String? {
            if (node == target) return path
            for (i in 0 until node.childCount) {
                val child = node.getChild(i) ?: continue
                val hit = searchPath(child, target, "${path}_$i")
                if (hit != null) return hit
            }
            return null
        }

        fun onStableState(snapshot: UiTreeCapture.Snapshot) {
            val before = lastStableStateId
            val after = snapshot.stateId
            lastStableStateId = after
            val eventSink = pendingEventsSink
            if (before != null && eventSink != null && pendingEvents.isNotEmpty()) {
                val drained = mutableListOf<PendingEvent>()
                while (true) drained += pendingEvents.poll() ?: break
                for (ev in drained) eventSink(ev, before, after)
            } else {
                pendingEvents.clear()
            }
            stateSink?.invoke(snapshot)
        }

        @Volatile
        private var pendingEventsSink: ((PendingEvent, before: String, after: String) -> Unit)? = null

        internal fun setEventsSink(fn: ((PendingEvent, String, String) -> Unit)?) {
            pendingEventsSink = fn
        }

        /**
         * Replay/Explorer entry point — take a fresh snapshot on demand rather
         * than waiting for the next debounced state.  Returns null when no
         * accessibility service is connected.
         */
        fun snapshotNow(packageName: String, screenName: String): UiTreeCapture.Snapshot? {
            val svc = service.get() ?: return null
            val root = svc.rootInActiveWindow ?: return null
            return UiTreeCapture.snapshot(root, packageName, screenName, System.currentTimeMillis())
        }

        /**
         * Find a node by `nodeId` and perform a click. Returns true on success.
         * `nodeId` is the path index we assigned during tree traversal.
         */
        fun performClick(nodeId: String): Boolean {
            val svc = service.get() ?: return false
            val root = svc.rootInActiveWindow ?: return false
            val node = findByPathId(root, nodeId, "n") ?: return false
            return node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)
        }

        fun performLongPress(nodeId: String): Boolean {
            val svc = service.get() ?: return false
            val root = svc.rootInActiveWindow ?: return false
            val node = findByPathId(root, nodeId, "n") ?: return false
            return node.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_LONG_CLICK)
        }

        fun performTypeText(nodeId: String, value: String): Boolean {
            val svc = service.get() ?: return false
            val root = svc.rootInActiveWindow ?: return false
            val node = findByPathId(root, nodeId, "n") ?: return false
            val args = android.os.Bundle().apply {
                putCharSequence(
                    android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    value,
                )
            }
            return node.performAction(
                android.view.accessibility.AccessibilityNodeInfo.ACTION_SET_TEXT,
                args,
            )
        }

        fun performBack(): Boolean {
            val svc = service.get() ?: return false
            return svc.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
        }

        private fun findByPathId(
            node: android.view.accessibility.AccessibilityNodeInfo?,
            target: String,
            currentPath: String,
        ): android.view.accessibility.AccessibilityNodeInfo? {
            if (node == null) return null
            if (currentPath == target) return node
            for (i in 0 until node.childCount) {
                val hit = findByPathId(node.getChild(i), target, "${currentPath}_$i")
                if (hit != null) return hit
            }
            return null
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
        // §10.2 — hold the process-wide operation lock for the entire session.
        com.techphantoms.pocketqa.OperationLock.acquire(
            com.techphantoms.pocketqa.OperationLock.Kind.CAPTURE, session.id
        )
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
        // Sink classified raw events into Room with the correct
        // beforeStateId / afterStateId bracket.
        setEventsSink { pending, before, after ->
            repo.appendClassifiedEvent(
                sessionId = session.id,
                action = pending.action,
                label = pending.label,
                nodeId = pending.nodeId,
                input = pending.input,
                beforeStateId = before,
                afterStateId = after,
                at = pending.at,
            )
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
        setEventsSink(null)
        com.techphantoms.pocketqa.OperationLock.release(
            com.techphantoms.pocketqa.OperationLock.Kind.CAPTURE, sessionId
        )
        val out = com.facebook.react.bridge.Arguments.createMap()
        out.putString("compileJobId", jobId)
        promise.resolve(out)
    }

    fun cancel(sessionId: String, deleteArtifacts: Boolean) {
        activePackage.set(null)
        activeSession.set(null)
        stateSink = null
        setEventsSink(null)
        com.techphantoms.pocketqa.OperationLock.release(
            com.techphantoms.pocketqa.OperationLock.Kind.CAPTURE, sessionId
        )
        repo.cancelSession(sessionId, deleteArtifacts)
    }

    private fun launchDemoShop(pkg: String) {
        val launch = ctx.packageManager.getLaunchIntentForPackage(pkg) ?: return
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        ctx.startActivity(launch)
    }
}
