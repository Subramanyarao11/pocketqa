package com.techphantoms.pocketqa.execution

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.techphantoms.pocketqa.OperationLock
import com.techphantoms.pocketqa.capture.CaptureCoordinator
import com.techphantoms.pocketqa.policy.FixtureLauncher
import com.techphantoms.pocketqa.inference.ConsentToken
import com.techphantoms.pocketqa.inference.TaskClient
import com.techphantoms.pocketqa.policy.PolicyEngine
import com.techphantoms.pocketqa.storage.JsonBridge
import com.techphantoms.pocketqa.storage.PocketQaRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonArray
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
    private val tasks: TaskClient? = null,
) {
    private companion object {
        const val POLL_MS = 150L
        const val SETTLE_MS = 400L
        /** Long enough for a keyboard dismissal or a window transition. */
        const val OBSERVE_TIMEOUT_MS = 4_000L
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
        val fixture = test["fixture"]?.jsonPrimitive?.contentOrNull
        val steps = test["steps"]?.jsonArray ?: JsonArray(emptyList())
        val stepResults = mutableListOf<JsonObject>()
        val assertionResults = mutableListOf<JsonObject>()
        var failure: JsonObject? = null

        emitProgress(runId, -1, steps.size, "Resetting fixture for $packageName…", null)
        // Real fixture reset is delegated to the target app's URI scheme in v0;
        // CLEAR_TASK gives us a clean start screen in the meantime.
        launchTarget(packageName, fixture, reset = true)
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
            if (front != null && front != packageName && !CaptureCoordinator.isOnScreen(packageName)) {
                failure = failureObject("target-app-crash",
                    "$packageName left the foreground before step ${idx + 1} ($front is in front).", null)
                stepResults += simpleStepResult(step, "fail", failure!!["summary"]!!.jsonPrimitive.content,
                    "TARGET_LOST_FOREGROUND", elapsedFrom(stepStart))
                break
            }
            val snapshot = when (val obs = observeWithRetry(packageName, screenNameFromStep(step))) {
                is CaptureCoordinator.Observation.Ok -> obs.snapshot
                is CaptureCoordinator.Observation.ServiceUnavailable -> {
                    failure = failureObject("permission-capture",
                        "Accessibility service still not connected after ${OBSERVE_TIMEOUT_MS}ms — " +
                            "check it is enabled for PocketQA in Accessibility settings.", null)
                    stepResults += simpleStepResult(step, "fail",
                        failure!!["summary"]!!.jsonPrimitive.content,
                        "ACCESSIBILITY_DISABLED", elapsedFrom(stepStart))
                    break
                }
                is CaptureCoordinator.Observation.NoWindow -> {
                    // Reported accurately: the service is connected and bound,
                    // so telling the operator to enable it sends them to a
                    // setting that is already on.
                    failure = failureObject("target-app-crash",
                        "No readable window for $packageName after ${OBSERVE_TIMEOUT_MS}ms — " +
                            "the accessibility service is connected, but the app " +
                            "presented nothing to observe.", null)
                    stepResults += simpleStepResult(step, "fail",
                        failure!!["summary"]!!.jsonPrimitive.content,
                        "WINDOW_UNAVAILABLE", elapsedFrom(stepStart))
                    break
                }
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
                    "tap"       -> observedNodeId?.let { CaptureCoordinator.performClick(it, packageName) } ?: false
                    "longPress" -> observedNodeId?.let { CaptureCoordinator.performLongPress(it, packageName) } ?: false
                    "typeText"  -> observedNodeId?.let {
                        CaptureCoordinator.performTypeText(
                            it, step["input"]?.jsonPrimitive?.contentOrNull.orEmpty(), packageName)
                    } ?: false
                    "clearText" -> observedNodeId?.let { CaptureCoordinator.performTypeText(it, "", packageName) } ?: false
                    "back"      -> CaptureCoordinator.performBack()
                    "wait"      -> { delay(step["waitMs"]?.jsonPrimitive?.content?.toLongOrNull() ?: 300L); true }
                    "launch"    -> { launchTarget(packageName, fixture); true }
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
            // Typing raises the keyboard over the lower third of the screen,
            // where a checkout or submit button usually lives. Dismiss before
            // observing, or the next step resolves against a tree in which its
            // target is reported invisible.
            if (action == "typeText" || action == "clearText") {
                if (CaptureCoordinator.dismissKeyboardIfShowing()) delay(SETTLE_MS)
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

        // Fire AI proposal layer concurrently. Each of these degrades to the
        // deterministic Failure Detective screen when unavailable, and every
        // failure path (unreachable, timeout, rejected output) is invisible
        // to the caller — the persisted run keeps its deterministic shape.
        runAiFailureAnalysis(runId, test, failure)

        emitFinished(runId, repo.readRunJson(runId) ?: summary)
        OperationLock.release(OperationLock.Kind.REPLAY, runId)
        repo.endActiveOperation()
        stopSignals.remove(runId)
        jobs.remove(runId)
    }

    // ---------- AI proposal layer (§4 items 3/6/7) ----------

    private suspend fun runAiFailureAnalysis(
        runId: String,
        test: JsonObject,
        failure: JsonObject?,
    ) {
        val client = tasks ?: return
        val testId = test["id"]?.jsonPrimitive?.contentOrNull.orEmpty()
        coroutineScope {
            val jobs = mutableListOf<kotlinx.coroutines.Deferred<Unit>>()

            // AI-1 explain_failure — only when the run failed.
            if (failure != null) {
                jobs += async {
                    val failureClass = taskFailureClass(
                        failure["category"]?.jsonPrimitive?.contentOrNull
                    )
                    val factSource = taskFactSource(failureClass)
                    val factId = "failure_fact"
                    val request = buildJsonObject {
                        put("intent", test["intent"] ?: JsonPrimitive("Test the approved mobile flow"))
                        put("failureClass", JsonPrimitive(failureClass))
                        put("stepLabel", JsonPrimitive(failingStepLabel(test, runId).orEmpty()))
                        put("facts", buildJsonArray {
                            add(buildJsonObject {
                                put("id", JsonPrimitive(factId))
                                put("source", JsonPrimitive(factSource))
                                put("statement", failure["summary"] ?: JsonPrimitive("The run failed."))
                            })
                        })
                        put("allowedFactIds", buildJsonArray { add(JsonPrimitive(factId)) })
                    }
                    val result = client.run(
                        taskId = "explain_failure",
                        request = request,
                        consent = ConsentToken.GrantedForOperation("explain_failure", runId),
                        timeoutMs = 7_000,
                    )
                    val explanation = result.value?.get("summary")?.jsonPrimitive?.contentOrNull
                    if (!explanation.isNullOrBlank()) {
                        repo.applyAiFailureExplanation(runId, explanation, result.provenance.toJsonObject())
                    }
                }
            }

            // AI-4 repair_selector — only for selector-drift.
            if (failure?.get("category")?.jsonPrimitive?.contentOrNull == "selector-drift") {
                jobs += async { runRepairSelectorProposal(client, runId, test, failure) }
            }

            // AI-5 classify_flake — only when we have >=2 prior runs so an
            // ambiguous middle exists to classify. Never suppresses the failure.
            val priors = repo.runsForTest(testId, limit = 6)
            if (priors.size >= 2) {
                jobs += async {
                    val failedRuns = priors.filter {
                        it["result"]?.jsonObject?.get("failure") != null
                    }
                    if (failedRuns.isEmpty()) return@async
                    val request = buildJsonObject {
                        put("runs", buildJsonArray {
                            for (r in failedRuns) {
                                val resultObj = r["result"]?.jsonObject ?: continue
                                val failureObj = resultObj["failure"]?.jsonObject ?: continue
                                val priorRunId = r["runId"]?.jsonPrimitive?.contentOrNull.orEmpty()
                                val failedStep = resultObj["stepResults"]?.jsonArray
                                    ?.map { it.jsonObject }
                                    ?.firstOrNull { it["status"]?.jsonPrimitive?.contentOrNull == "fail" }
                                add(buildJsonObject {
                                    put("runId", JsonPrimitive(priorRunId))
                                    put("stepIndex", JsonPrimitive(
                                        failedStep?.get("stepId")?.jsonPrimitive?.contentOrNull
                                            ?.substringAfterLast('_')?.toIntOrNull() ?: 0
                                    ))
                                    put("stepLabel", JsonPrimitive(
                                        failedStep?.get("reason")?.jsonPrimitive?.contentOrNull.orEmpty()
                                    ))
                                    put("features", flakeFeatures(
                                        failureObj["category"]?.jsonPrimitive?.contentOrNull
                                    ))
                                })
                            }
                        })
                        put("allowedRunIds", buildJsonArray {
                            failedRuns.forEach { prior ->
                                prior["runId"]?.let(::add)
                            }
                        })
                    }
                    val result = client.run(
                        taskId = "classify_flake",
                        request = request,
                        consent = ConsentToken.GrantedForOperation("classify_flake", runId),
                        timeoutMs = 7_000,
                    )
                    val classified = result.value?.get("classified")?.jsonArray
                    if (classified != null) {
                        val hasPass = priors.any {
                            it["result"]?.jsonObject?.get("passed")?.jsonPrimitive?.contentOrNull == "true"
                        }
                        val verdict = if (hasPass && failedRuns.isNotEmpty()) "flake" else "regression"
                        val reason = result.value?.get("groups")?.jsonArray?.firstOrNull()
                            ?.jsonObject?.get("sharedCause")?.jsonPrimitive?.contentOrNull
                            ?: classified.firstOrNull()?.jsonObject?.get("failureClass")
                                ?.jsonPrimitive?.contentOrNull
                        repo.applyFlakeVerdict(
                            runId = runId,
                            verdict = verdict,
                            reason = reason,
                            provenance = result.provenance.toJsonObject(),
                        )
                    }
                }
            }

            jobs.awaitAll()
        }
    }

    private suspend fun runRepairSelectorProposal(
        client: TaskClient,
        runId: String,
        test: JsonObject,
        failure: JsonObject,
    ) {
        // Find the failing step + observe the failing state deterministically.
        val stateId = failure["evidenceStateId"]?.jsonPrimitive?.contentOrNull ?: return
        val runJson = repo.readRunJson(runId) ?: return
        val failingStepId = runJson["result"]?.jsonObject?.get("stepResults")?.jsonArray
            ?.firstOrNull { it.jsonObject["status"]?.jsonPrimitive?.contentOrNull == "fail" }
            ?.jsonObject?.get("stepId")?.jsonPrimitive?.contentOrNull ?: return
        val step = test["steps"]?.jsonArray?.map { it.jsonObject }
            ?.firstOrNull { it["id"]?.jsonPrimitive?.contentOrNull == failingStepId } ?: return
        val selector = step["selector"]?.jsonObject ?: return
        val state = repo.uiStateRaw(stateId) ?: return

        // Gather all resolvable candidate anchors from the failing state so
        // the merge rule can reject anything the model didn't get from us.
        val anchorList = mutableListOf<JsonObject>()
        state["nodes"]?.jsonArray?.map { it.jsonObject }?.forEach { node ->
            listOf(
                "testId" to node["testId"]?.jsonPrimitive?.contentOrNull,
                "resourceId" to node["resourceId"]?.jsonPrimitive?.contentOrNull,
                "accessibilityLabel" to node["contentDescription"]?.jsonPrimitive?.contentOrNull,
                "textAndRole" to node["text"]?.jsonPrimitive?.contentOrNull,
            ).forEach { (strategy, value) ->
                if (!value.isNullOrBlank()) {
                    anchorList += buildJsonObject {
                        put("strategy", JsonPrimitive(strategy))
                        put("value", JsonPrimitive(value))
                        put("nodeId", node["nodeId"] ?: JsonPrimitive(""))
                    }
                }
            }
        }
        if (anchorList.isEmpty()) return

        val nodesById = state["nodes"]?.jsonArray?.map { it.jsonObject }
            ?.associateBy { it["nodeId"]?.jsonPrimitive?.contentOrNull.orEmpty() }
            ?: return
        val primary = selector["primary"]?.jsonObject ?: return
        val request = buildJsonObject {
            put("brokenSelector", buildJsonObject {
                put("id", JsonPrimitive(failingStepId))
                put("kind", primary["strategy"] ?: JsonPrimitive("unknown"))
                when (primary["strategy"]?.jsonPrimitive?.contentOrNull) {
                    "resourceId" -> put("resourceId", primary["value"] ?: JsonPrimitive(""))
                    "accessibilityLabel" -> put("contentDescription", primary["value"] ?: JsonPrimitive(""))
                    "textAndRole" -> put("text", primary["value"] ?: JsonPrimitive(""))
                }
            })
            put("currentNodes", buildJsonArray {
                nodesById.values.forEach { add(taskNodeSummary(it)) }
            })
            put("allowedNodeIds", buildJsonArray {
                nodesById.keys.filter { it.isNotBlank() }.forEach { add(JsonPrimitive(it)) }
            })
            put("intentHint", test["intent"] ?: JsonPrimitive(""))
        }
        val result = client.run(
            taskId = "repair_selector",
            request = request,
            consent = ConsentToken.GrantedForOperation("repair_selector", runId),
            timeoutMs = 7_000,
        )
        val best = result.value?.get("ranked")?.jsonArray?.firstOrNull()?.jsonObject ?: return
        val proposedNode = nodesById[best["nodeId"]?.jsonPrimitive?.contentOrNull] ?: return
        val (strategy, value) = strongestAnchor(proposedNode) ?: return
        val confidence = best["score"]?.jsonPrimitive?.doubleOrNull ?: 0.0

        // Verify deterministically: the proposal must resolve to exactly one
        // node in the failing state. If not, drop it — the model is proposing
        // something the executor cannot use.
        val matches = state["nodes"]?.jsonArray?.map { it.jsonObject }?.filter { node ->
            when (strategy) {
                "testId" -> node["testId"]?.jsonPrimitive?.contentOrNull == value
                "resourceId" -> node["resourceId"]?.jsonPrimitive?.contentOrNull == value
                "accessibilityLabel" -> node["contentDescription"]?.jsonPrimitive?.contentOrNull == value
                "textAndRole" -> node["text"]?.jsonPrimitive?.contentOrNull == value
                else -> false
            }
        } ?: emptyList()
        if (matches.size != 1) return

        repo.applyAiSelectorRepairProposal(
            runId = runId,
            stepId = failingStepId,
            strategy = strategy,
            value = value,
            confidence = confidence,
            provenance = result.provenance.toJsonObject(),
        )
    }

    private fun failingStepLabel(test: JsonObject, runId: String): String? {
        val failedStepId = repo.readRunJson(runId)?.get("result")?.jsonObject
            ?.get("stepResults")?.jsonArray?.map { it.jsonObject }
            ?.firstOrNull { it["status"]?.jsonPrimitive?.contentOrNull == "fail" }
            ?.get("stepId")?.jsonPrimitive?.contentOrNull
        return test["steps"]?.jsonArray?.map { it.jsonObject }
            ?.firstOrNull { it["id"]?.jsonPrimitive?.contentOrNull == failedStepId }
            ?.get("label")?.jsonPrimitive?.contentOrNull
    }

    private fun taskFailureClass(category: String?): String = when (category) {
        "selector-drift" -> "SELECTOR_DRIFT"
        "assertion-regression" -> "ASSERTION_REGRESSION"
        "navigation-divergence" -> "NAVIGATION_DIVERGENCE"
        "timeout-performance" -> "TIMEOUT_PERFORMANCE"
        "target-app-crash" -> "APP_CRASH"
        "fixture-environment" -> "FIXTURE_ENVIRONMENT"
        "permission-capture" -> "CAPTURE_LIMITATION"
        else -> "UNKNOWN"
    }

    private fun taskFactSource(failureClass: String): String = when (failureClass) {
        "SELECTOR_DRIFT" -> "SELECTOR"
        "ASSERTION_REGRESSION" -> "ASSERTION"
        "TIMEOUT_PERFORMANCE" -> "TIMING"
        "APP_CRASH" -> "DEVICE"
        "FIXTURE_ENVIRONMENT" -> "FIXTURE"
        "CAPTURE_LIMITATION" -> "CAPTURE"
        else -> "STATE_DIFF"
    }

    private fun flakeFeatures(category: String?): JsonObject = buildJsonObject {
        val failureClass = taskFailureClass(category)
        put("selectorResolutionCount", JsonPrimitive(if (failureClass == "SELECTOR_DRIFT") 0 else 1))
        put("similarNodePresent", JsonPrimitive(failureClass == "SELECTOR_DRIFT"))
        put("expectedFactPresent", JsonPrimitive(false))
        put("navigationActionsSucceeded", JsonPrimitive(failureClass != "NAVIGATION_DIVERGENCE"))
        put("fingerprintChanged", JsonPrimitive(failureClass == "NAVIGATION_DIVERGENCE"))
        put("windowChanged", JsonPrimitive(failureClass == "NAVIGATION_DIVERGENCE"))
        put("appearedAfterBudget", JsonPrimitive(failureClass == "TIMEOUT_PERFORMANCE"))
        put("processAlive", JsonPrimitive(failureClass != "APP_CRASH"))
        put("crashSignal", JsonPrimitive(failureClass == "APP_CRASH"))
        put("fixtureResetOk", JsonPrimitive(failureClass != "FIXTURE_ENVIRONMENT"))
        put("startedInExpectedState", JsonPrimitive(failureClass != "FIXTURE_ENVIRONMENT"))
        put("treeAvailable", JsonPrimitive(failureClass != "CAPTURE_LIMITATION"))
        put("screenshotAvailable", JsonPrimitive(true))
        put("serviceConnected", JsonPrimitive(failureClass != "CAPTURE_LIMITATION"))
    }

    private fun taskNodeSummary(node: JsonObject): JsonObject = buildJsonObject {
        put("nodeId", node["nodeId"] ?: JsonPrimitive(""))
        put("role", JsonPrimitive(taskRole(node["role"]?.jsonPrimitive?.contentOrNull)))
        node["resourceId"]?.let { put("resourceId", it) }
        node["text"]?.let { put("text", it) }
        node["contentDescription"]?.let { put("contentDescription", it) }
        put("enabled", node["enabled"] ?: JsonPrimitive(true))
        put("visible", node["visible"] ?: JsonPrimitive(true))
        put("clickable", node["clickable"] ?: JsonPrimitive(false))
        put("editable", node["editable"] ?: JsonPrimitive(false))
        put("checkable", node["checkable"] ?: JsonPrimitive(false))
        node["checked"]?.let { put("checked", it) }
        put("selected", node["selected"] ?: JsonPrimitive(false))
        put("focusable", node["focusable"] ?: JsonPrimitive(false))
    }

    private fun taskRole(role: String?): String = when (role) {
        "button" -> "BUTTON"
        "text" -> "TEXT"
        "textField", "passwordField", "otpField", "pinField" -> "INPUT"
        "checkbox" -> "CHECKBOX"
        "switch" -> "SWITCH"
        "image" -> "IMAGE"
        else -> "UNKNOWN"
    }

    private fun strongestAnchor(node: JsonObject): Pair<String, String>? {
        node["testId"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            ?.let { return "testId" to it }
        node["resourceId"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            ?.let { return "resourceId" to it }
        node["contentDescription"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            ?.let { return "accessibilityLabel" to it }
        node["text"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            ?.let { return "textAndRole" to it }
        return null
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
        val label = "${primary?.get("strategy")?.jsonPrimitive?.contentOrNull} " +
            "${primary?.get("value")?.jsonPrimitive?.contentOrNull.orEmpty()}"
        // A control that is present but obscured or off-screen is a different
        // fault from one that is gone, and saying "no node matched" sends the
        // operator to repair a selector that was never wrong.
        val hiddenMatch = strategies.any { sel ->
            matchNodes(sel, nodes, requireVisible = false).isNotEmpty()
        }
        if (hiddenMatch) {
            return Resolve.Fail("TARGET_NOT_VISIBLE",
                "$label is present but not visible — it is covered or off-screen.")
        }
        return Resolve.Fail("TARGET_NOT_FOUND", "No node matched $label.")
    }

    private fun matchNodes(
        sel: JsonObject,
        nodes: List<JsonObject>,
        requireVisible: Boolean = true,
    ): List<JsonObject> {
        val strategy = sel["strategy"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val value = sel["value"]?.jsonPrimitive?.contentOrNull.orEmpty()
        val role = sel["role"]?.jsonPrimitive?.contentOrNull
        return nodes.filter { n ->
            if (requireVisible && n["visible"]?.jsonPrimitive?.contentOrNull != "true") return@filter false
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
    private fun launchTarget(packageName: String, fixture: String?, reset: Boolean = false) {
        val launch = FixtureLauncher.targetIntent(ctx, packageName, fixture, reset) ?: return
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
            if (CaptureCoordinator.isOnScreen(packageName)) {
                delay(SETTLE_MS) // let the first frame lay out before observing
                return true
            }
            delay(POLL_MS)
        }
        return CaptureCoordinator.isOnScreen(packageName)
    }

    /**
     * Observe, tolerating a window that is not readable yet.
     *
     * A replay observes immediately after actions that move windows — a tap that
     * navigates, a typeText that raises the keyboard — so the first read landing
     * mid-transition is the normal case, not an error. Only a disconnected
     * service is worth failing on straight away; everything else is worth
     * waiting out.
     */
    private suspend fun observeWithRetry(
        packageName: String,
        screenName: String,
        timeoutMs: Long = OBSERVE_TIMEOUT_MS,
    ): CaptureCoordinator.Observation {
        val deadline = System.currentTimeMillis() + timeoutMs
        var last: CaptureCoordinator.Observation = CaptureCoordinator.Observation.NoWindow
        while (System.currentTimeMillis() < deadline) {
            last = CaptureCoordinator.observe(packageName, screenName)
            if (last is CaptureCoordinator.Observation.Ok) return last
            // A disconnected service is retried too, and this is the correction
            // that mattered: setting serviceInfo rebinds the service, so the
            // reference is briefly null while the old instance is torn down and
            // the new one connects. Treating that instant as terminal aborted a
            // run whose service was enabled and bound the whole time — which is
            // exactly what the failing step reported. Four seconds of "still
            // gone" is a real fault; ten milliseconds of it is a handover.
            delay(POLL_MS)
        }
        return last
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
