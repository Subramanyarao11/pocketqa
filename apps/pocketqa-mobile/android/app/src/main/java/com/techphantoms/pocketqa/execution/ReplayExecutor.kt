package com.techphantoms.pocketqa.execution

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.techphantoms.pocketqa.OperationLock
import com.techphantoms.pocketqa.capture.CaptureCoordinator
import com.techphantoms.pocketqa.policy.PolicyEngine
import com.techphantoms.pocketqa.storage.JsonBridge
import com.techphantoms.pocketqa.storage.PocketQaRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * ReplayExecutor — the only component allowed to dispatch UI actions.
 *
 * Contract (mirrors `src/domain/executor.ts`):
 *   * Loads only an approved, immutable ApprovedTest by (id, version).
 *   * For each step: verify active package → observe current state →
 *     resolve exactly one target → policy classify → deterministic action →
 *     wait for idle → evaluate assertions → persist evidence.
 *   * On ambiguity or blocked category: hard stop; no coordinate fallback.
 *   * Never asks an inference model what to do next.
 */
class ReplayExecutor(
    private val ctx: ReactApplicationContext,
    private val repo: PocketQaRepository,
    private val policy: PolicyEngine,
) {
    private companion object {
        const val POLL_MS = 150L
        const val SETTLE_MS = 400L
    }

    private val scope = CoroutineScope(Dispatchers.Default)
    private val stopSignals = ConcurrentHashMap<String, Boolean>()
    private val jobs = ConcurrentHashMap<String, Job>()

    fun start(testId: String, version: Int, promise: Promise) {
        val testMap = repo.getTest(testId, version)
        val testJson = JsonBridge.readableMapToJsonString(testMap)
        val test = JsonBridge.json.parseToJsonElement(testJson).jsonObject
        if (test.isEmpty()) return promise.reject("TEST_NOT_FOUND", "test not found")

        val runId = "run_" + UUID.randomUUID().toString().take(8)
        OperationLock.acquire(OperationLock.Kind.REPLAY, runId)
        repo.beginActiveOperation("REPLAY", runId)
        stopSignals[runId] = false
        val out = Arguments.createMap()
        out.putString("runId", runId)
        promise.resolve(out)

        jobs[runId] = scope.launch { runReplay(runId, test) }
    }

    fun stop(runId: String) { stopSignals[runId] = true }

    // ---------- core loop ----------

    private suspend fun runReplay(runId: String, test: JsonObject) {
        val startedAt = System.currentTimeMillis()
        val packageName = test["packageName"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val steps = test["steps"]?.jsonArray ?: JsonArray(emptyList())
        val stepResults = mutableListOf<JsonObject>()
        val assertionResults = mutableListOf<JsonObject>()
        var failure: JsonObject? = null

        emitProgress(runId, -1, steps.size, "Resetting fixture for $packageName…", null)
        // Real fixture reset is delegated to the target app's URI scheme in v0;
        // CLEAR_TASK gives us a clean start screen in the meantime.
        launchTarget(packageName, reset = true)
        if (!awaitForeground(packageName)) {
            failure = failureObject("target-app-crash",
                "$packageName did not come to the foreground within 8s.", null)
            emitProgress(runId, -1, steps.size, "✗ ${failure["summary"]!!.jsonPrimitive.content}", pass = false)
        }

        for ((idx, raw) in steps.withIndex()) {
            if (failure != null) break
            if (stopSignals[runId] == true) {
                failure = failureObject("policy-hard-stop", "User pressed Stop before this step.", null)
                stepResults += simpleStepResult(raw.jsonObject, "skipped", "User stop", null, 0)
                break
            }
            val step = raw.jsonObject
            val label = step["label"]?.jsonPrimitive?.contentOrNull.orEmpty()
            val action = step["action"]?.jsonPrimitive?.contentOrNull.orEmpty()
            val stepStart = System.currentTimeMillis()

            // 1) Package boundary.
            if (!policy.inAllowlist(packageName)) {
                failure = failureObject("policy-hard-stop", "Package $packageName not in allowlist.", null)
                stepResults += simpleStepResult(step, "fail", failure!!["summary"]!!.jsonPrimitive.content,
                    "PACKAGE_BOUNDARY_VIOLATION", elapsedFrom(stepStart))
                break
            }

            // 2) Observe current state via CaptureCoordinator (which owns the service).
            // If the target lost the foreground (crash, ANR, an interstitial),
            // say that plainly instead of reporting selector-drift against
            // whatever screen happens to be in front.
            val front = CaptureCoordinator.foregroundPackage()
            if (front != null && front != packageName) {
                failure = failureObject("target-app-crash",
                    "$packageName left the foreground before step ${idx + 1} ($front is in front).", null)
                stepResults += simpleStepResult(step, "fail", failure!!["summary"]!!.jsonPrimitive.content,
                    "TARGET_LOST_FOREGROUND", elapsedFrom(stepStart))
                break
            }
            val snapshot = CaptureCoordinator.snapshotNow(packageName, screenNameFromStep(step))
            if (snapshot == null) {
                failure = failureObject("permission-capture",
                    "Accessibility service unavailable — can't observe state.", null)
                stepResults += simpleStepResult(step, "fail", failure!!["summary"]!!.jsonPrimitive.content,
                    "ACCESSIBILITY_DISABLED", elapsedFrom(stepStart))
                break
            }
            val stateObj = JsonBridge.json.parseToJsonElement(snapshot.payload).jsonObject
            repo.persistUIState(snapshot.stateId, packageName,
                stateObj["screenName"]?.jsonPrimitive?.contentOrNull ?: "screen", snapshot.payload)

            // 3) Resolve selector (if the action needs a target).
            var observedNodeId: String? = null
            var usedFallback = false
            val selector = step["selector"]?.jsonObject
            if (selector != null && action in listOf("tap", "longPress", "typeText", "clearText")) {
                val resolved = resolveSelector(selector, stateObj)
                when (resolved) {
                    is Resolve.Ok -> {
                        observedNodeId = resolved.nodeId
                        usedFallback = resolved.usedFallback
                        val targetNode = stateObj["nodes"]?.jsonArray
                            ?.map { it.jsonObject }
                            ?.firstOrNull { it["nodeId"]?.jsonPrimitive?.contentOrNull == resolved.nodeId }
                        val hardStop = classifyNode(targetNode)
                        if (hardStop != null) {
                            failure = failureObject("policy-hard-stop", hardStop.second, snapshot.stateId)
                            stepResults += simpleStepResult(step, "fail", hardStop.second,
                                hardStop.first, elapsedFrom(stepStart), beforeState = snapshot.stateId)
                            break
                        }
                    }
                    is Resolve.Fail -> {
                        failure = failureObject("selector-drift", resolved.message, snapshot.stateId)
                        stepResults += simpleStepResult(step, "fail", resolved.message,
                            resolved.code, elapsedFrom(stepStart), beforeState = snapshot.stateId)
                        break
                    }
                }
            }

            emitProgress(runId, idx, steps.size,
                "▶ $label${if (usedFallback) " (fallback selector)" else ""}",
                latestAssertion = null)

            // 4) Dispatch action.
            val dispatched = try {
                when (action) {
                    "tap"       -> observedNodeId?.let { CaptureCoordinator.performClick(it) } ?: false
                    "longPress" -> observedNodeId?.let { CaptureCoordinator.performLongPress(it) } ?: false
                    "typeText"  -> observedNodeId?.let {
                        CaptureCoordinator.performTypeText(it, step["input"]?.jsonPrimitive?.contentOrNull.orEmpty())
                    } ?: false
                    "clearText" -> observedNodeId?.let { CaptureCoordinator.performTypeText(it, "") } ?: false
                    "back"      -> CaptureCoordinator.performBack()
                    "wait"      -> { delay(step["waitMs"]?.jsonPrimitive?.content?.toLongOrNull() ?: 300L); true }
                    "launch"    -> { launchTarget(packageName); true }
                    else        -> true
                }
            } catch (e: Throwable) {
                failure = failureObject("target-app-crash", e.message ?: "action error", snapshot.stateId)
                stepResults += simpleStepResult(step, "fail", failure!!["summary"]!!.jsonPrimitive.content,
                    "EXECUTOR_ERROR", elapsedFrom(stepStart), beforeState = snapshot.stateId)
                break
            }
            if (!dispatched) {
                failure = failureObject("selector-drift",
                    "Dispatch failed for ${action}: node did not accept the action.", snapshot.stateId)
                stepResults += simpleStepResult(step, "fail", failure!!["summary"]!!.jsonPrimitive.content,
                    "ACTION_REFUSED", elapsedFrom(stepStart), beforeState = snapshot.stateId)
                break
            }
            awaitSettled(packageName, screenNameFromStep(step))

            // 5) Post-state + assertions.
            val postSnapshot = CaptureCoordinator.snapshotNow(packageName, screenNameFromStep(step))
            val postObj = if (postSnapshot != null) {
                repo.persistUIState(postSnapshot.stateId, packageName,
                    stateObj["screenName"]?.jsonPrimitive?.contentOrNull ?: "screen", postSnapshot.payload)
                JsonBridge.json.parseToJsonElement(postSnapshot.payload).jsonObject
            } else stateObj

            val stepAssertions = step["assertions"]?.jsonArray ?: JsonArray(emptyList())
            val stepAssertionResults = evaluateAssertions(stepAssertions, postObj)
            assertionResults += stepAssertionResults
            val firstFail = stepAssertionResults.firstOrNull { it["status"]?.jsonPrimitive?.contentOrNull == "fail" }
            if (firstFail != null) {
                val expected = firstFail["expected"]?.jsonPrimitive?.contentOrNull.orEmpty()
                val summary = "Assertion failed: expected \"$expected\"."
                failure = failureObject("assertion-regression", summary, postSnapshot?.stateId)
                stepResults += simpleStepResult(step, "fail", summary, "ASSERTION_FAILED",
                    elapsedFrom(stepStart), beforeState = snapshot.stateId, afterState = postSnapshot?.stateId,
                    observedNodeId = observedNodeId)
                emitProgress(runId, idx, steps.size, "✗ $summary", pass = false)
                break
            }

            stepResults += simpleStepResult(step, "pass", null, null,
                elapsedFrom(stepStart), beforeState = snapshot.stateId, afterState = postSnapshot?.stateId,
                observedNodeId = observedNodeId)
            emitProgress(runId, idx, steps.size, "✓ step passed", pass = true)
        }

        // Final assertions.
        if (failure == null) {
            val finalAssertions = test["finalAssertions"]?.jsonArray ?: JsonArray(emptyList())
            val finalSnapshot = CaptureCoordinator.snapshotNow(packageName, "final")
            val finalObj = if (finalSnapshot != null) {
                repo.persistUIState(finalSnapshot.stateId, packageName, "final", finalSnapshot.payload)
                JsonBridge.json.parseToJsonElement(finalSnapshot.payload).jsonObject
            } else JsonObject(emptyMap())
            val finalResults = evaluateAssertions(finalAssertions, finalObj)
            assertionResults += finalResults
            val finalFail = finalResults.firstOrNull { it["status"]?.jsonPrimitive?.contentOrNull == "fail" }
            if (finalFail != null) {
                val expected = finalFail["expected"]?.jsonPrimitive?.contentOrNull.orEmpty()
                failure = failureObject("assertion-regression",
                    "Final assertion failed: expected \"$expected\".", finalSnapshot?.stateId)
                emitProgress(runId, steps.size, steps.size, "✗ ${failure["summary"]!!.jsonPrimitive.content}", pass = false)
            } else {
                emitProgress(runId, steps.size, steps.size, "✓ all final assertions passed", pass = true)
            }
        }

        val finishedAt = System.currentTimeMillis()
        val result = buildJsonObject {
            put("runId", JsonPrimitive(runId))
            put("testId", test["id"] ?: JsonPrimitive(""))
            put("testVersion", test["version"] ?: JsonPrimitive(1))
            put("startedAt", JsonPrimitive(startedAt))
            put("finishedAt", JsonPrimitive(finishedAt))
            put("passed", JsonPrimitive(failure == null))
            put("offline", JsonPrimitive(true))
            put("stepResults", JsonArray(stepResults))
            put("assertionResults", JsonArray(assertionResults))
            if (failure != null) put("failure", failure!!)
        }
        val summary = buildJsonObject {
            put("runId", JsonPrimitive(runId))
            put("test", test)
            put("result", result)
        }
        repo.persistRun(runId,
            test["id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            test["version"]?.jsonPrimitive?.content?.toIntOrNull() ?: 1,
            failure == null,
            summary.toString())

        emitFinished(runId, summary)
        OperationLock.release(OperationLock.Kind.REPLAY, runId)
        repo.endActiveOperation()
        stopSignals.remove(runId)
        jobs.remove(runId)
    }

    // ---------- selector resolution ----------

    private sealed class Resolve {
        data class Ok(val nodeId: String, val usedFallback: Boolean) : Resolve()
        data class Fail(val code: String, val message: String) : Resolve()
    }

    private fun resolveSelector(selector: JsonObject, state: JsonObject): Resolve {
        val strategies = mutableListOf<JsonObject>()
        selector["primary"]?.jsonObject?.let { strategies += it }
        selector["fallbacks"]?.jsonArray?.forEach { strategies += it.jsonObject }
        val nodes = state["nodes"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
        for ((i, sel) in strategies.withIndex()) {
            val matches = matchNodes(sel, nodes)
            if (matches.size == 1) return Resolve.Ok(
                nodeId = matches[0]["nodeId"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                usedFallback = i > 0,
            )
            if (matches.size > 1 && i == strategies.lastIndex) {
                return Resolve.Fail("TARGET_AMBIGUOUS",
                    "${matches.size} nodes matched ${sel["value"]?.jsonPrimitive?.contentOrNull}.")
            }
        }
        val primary = strategies.firstOrNull()
        return Resolve.Fail("TARGET_NOT_FOUND",
            "No node matched ${primary?.get("strategy")?.jsonPrimitive?.contentOrNull} " +
                "${primary?.get("value")?.jsonPrimitive?.contentOrNull.orEmpty()}.")
    }

    private fun matchNodes(sel: JsonObject, nodes: List<JsonObject>): List<JsonObject> {
        val strategy = sel["strategy"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val value = sel["value"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val role = sel["role"]?.jsonPrimitive?.contentOrNull
        return nodes.filter { n ->
            if (n["visible"]?.jsonPrimitive?.contentOrNull != "true") return@filter false
            when (strategy) {
                "testId"             -> n["testId"]?.jsonPrimitive?.contentOrNull == value
                "resourceId"         -> n["resourceId"]?.jsonPrimitive?.contentOrNull == value
                "accessibilityLabel" -> n["contentDescription"]?.jsonPrimitive?.contentOrNull == value
                "textAndRole"        -> n["text"]?.jsonPrimitive?.contentOrNull == value &&
                                        (role == null || n["role"]?.jsonPrimitive?.contentOrNull == role)
                "roleAndRelation"    -> n["role"]?.jsonPrimitive?.contentOrNull == role
                "relativePosition"   -> n["testId"]?.jsonPrimitive?.contentOrNull == value
                "coordinates"        -> false
                else                 -> false
            }
        }
    }

    // ---------- assertions ----------

    private fun evaluateAssertions(assertions: JsonArray, state: JsonObject): List<JsonObject> {
        val visible = mutableSetOf<String>()
        state["nodes"]?.jsonArray?.forEach { n ->
            val obj = n.jsonObject
            if (obj["visible"]?.jsonPrimitive?.contentOrNull == "true") {
                obj["text"]?.jsonPrimitive?.contentOrNull?.let { visible += it }
            }
        }
        state["ocrText"]?.jsonArray?.forEach { visible += it.jsonPrimitive.content }
        return assertions.map { raw ->
            val a = raw.jsonObject
            val kind = a["kind"]?.jsonPrimitive?.contentOrNull
            val target = a["target"]?.jsonPrimitive?.contentOrNull.orEmpty()
            val status = when (kind) {
                "textVisible" -> if (visible.contains(target) || visible.any { it.contains(target) }) "pass" else "fail"
                "textAbsent"  -> if (!visible.contains(target)) "pass" else "fail"
                "onScreen"    -> {
                    val hit = state["nodes"]?.jsonArray?.any {
                        it.jsonObject["nodeId"]?.jsonPrimitive?.contentOrNull == target &&
                            it.jsonObject["visible"]?.jsonPrimitive?.contentOrNull == "true"
                    } == true
                    if (hit) "pass" else "fail"
                }
                else -> "pass"
            }
            buildJsonObject {
                put("assertionId", a["id"] ?: JsonPrimitive(UUID.randomUUID().toString()))
                put("status", JsonPrimitive(status))
                put("expected", JsonPrimitive(target))
                put("observed", JsonPrimitive(visible.joinToString(" | ")))
            }
        }
    }

    // ---------- helpers ----------

    private fun screenNameFromStep(step: JsonObject): String =
        step["beforeStateId"]?.jsonPrimitive?.contentOrNull?.substringBeforeLast('_') ?: "screen"

    private fun elapsedFrom(startedAt: Long): Long = System.currentTimeMillis() - startedAt

    /**
     * Bring the target app up at its start screen.
     *
     * CLEAR_TASK matters: without it the launcher intent resumes whatever task
     * the app already had, so a replay inherits the screen a previous run (or
     * the demonstration itself) left behind and step 1 resolves against the
     * wrong state. A regression test has to control its own starting point.
     */
    private fun launchTarget(packageName: String, reset: Boolean = false) {
        val launch = ctx.packageManager.getLaunchIntentForPackage(packageName) ?: return
        launch.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        if (reset) launch.addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
        ctx.startActivity(launch)
    }

    /**
     * Wait until [packageName] actually owns the active window. Replacing a
     * fixed sleep with a real readiness check is the difference between a run
     * that is reliable on a cold app and one that races the first frame.
     */
    private suspend fun awaitForeground(packageName: String, timeoutMs: Long = 8_000): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (CaptureCoordinator.foregroundPackage() == packageName) {
                delay(SETTLE_MS) // let the first frame lay out before observing
                return true
            }
            delay(POLL_MS)
        }
        return CaptureCoordinator.foregroundPackage() == packageName
    }

    /**
     * Wait for the UI to stop changing after an action: two consecutive
     * identical trees, or [timeoutMs]. A tap that navigates needs more than a
     * fixed 120ms before the next observation is meaningful.
     */
    private suspend fun awaitSettled(packageName: String, screenName: String, timeoutMs: Long = 3_000) {
        val deadline = System.currentTimeMillis() + timeoutMs
        var previous: String? = null
        while (System.currentTimeMillis() < deadline) {
            delay(POLL_MS)
            val current = CaptureCoordinator.snapshotNow(packageName, screenName)?.payload ?: continue
            if (current == previous) return
            previous = current
        }
    }

    private fun failureObject(category: String, summary: String, stateId: String?): JsonObject =
        buildJsonObject {
            put("category", JsonPrimitive(category))
            put("summary", JsonPrimitive(summary))
            if (stateId != null) put("evidenceStateId", JsonPrimitive(stateId))
        }

    private fun classifyNode(node: JsonObject?): Pair<String, String>? {
        node ?: return null
        val text = node["text"]?.jsonPrimitive?.contentOrNull
        val cd = node["contentDescription"]?.jsonPrimitive?.contentOrNull
        if (policy.isSensitive(text) || policy.isSensitive(cd)) {
            return "SENSITIVE_TARGET_BLOCKED" to "Target is a sensitive field."
        }
        val role = node["role"]?.jsonPrimitive?.contentOrNull
        if (role in listOf("passwordField", "otpField", "pinField")) {
            return "SENSITIVE_TARGET_BLOCKED" to "Target is a sensitive input role."
        }
        if (policy.isBlockedCategory(text) || policy.isBlockedCategory(cd)) {
            return "BLOCKED_CATEGORY" to "Target matches blocked action keyword."
        }
        return null
    }

    private fun simpleStepResult(
        step: JsonObject,
        status: String,
        reason: String?,
        errorCode: String?,
        elapsedMs: Long,
        beforeState: String? = null,
        afterState: String? = null,
        observedNodeId: String? = null,
    ): JsonObject = buildJsonObject {
        put("stepId", step["id"] ?: JsonPrimitive(""))
        put("status", JsonPrimitive(status))
        put("elapsedMs", JsonPrimitive(elapsedMs))
        if (reason != null) put("reason", JsonPrimitive(reason))
        if (errorCode != null) put("errorCode", JsonPrimitive(errorCode))
        if (beforeState != null) put("beforeStateId", JsonPrimitive(beforeState))
        if (afterState != null) put("afterStateId", JsonPrimitive(afterState))
        if (observedNodeId != null) put("observedNodeId", JsonPrimitive(observedNodeId))
    }

    // ---------- events ----------

    private fun emitProgress(runId: String, stepIndex: Int, totalSteps: Int, label: String, pass: Boolean? = null, latestAssertion: WritableMap? = null) {
        val payload = Arguments.createMap()
        payload.putString("runId", runId)
        payload.putInt("stepIndex", stepIndex)
        payload.putInt("totalSteps", totalSteps)
        payload.putString("currentLabel", label)
        payload.putInt("elapsedMs", 0)
        if (pass != null) {
            val assertion = latestAssertion ?: Arguments.createMap().apply {
                putBoolean("pass", pass)
                putString("label", label)
            }
            payload.putMap("latestAssertion", assertion)
        }
        sendEvent("REPLAY_PROGRESS", payload)
    }

    private fun emitFinished(runId: String, summary: JsonObject) {
        val payload = JsonBridge.toWritableMap(summary.toString())
        sendEvent("REPLAY_FINISHED", payload)
    }

    private fun sendEvent(type: String, payload: WritableMap) {
        val envelope = Arguments.createMap()
        envelope.putString("type", type)
        envelope.putMap("payload", payload)
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("PocketQaEvent", envelope)
    }
}
