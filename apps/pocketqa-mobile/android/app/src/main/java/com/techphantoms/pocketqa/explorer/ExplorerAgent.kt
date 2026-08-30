package com.techphantoms.pocketqa.explorer

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.techphantoms.pocketqa.OperationLock
import com.techphantoms.pocketqa.capture.CaptureCoordinator
import com.techphantoms.pocketqa.inference.ConsentToken
import com.techphantoms.pocketqa.inference.InferenceRouter
import com.techphantoms.pocketqa.inference.TaskClient
import com.techphantoms.pocketqa.policy.PolicyEngine
import com.techphantoms.pocketqa.storage.JsonBridge
import com.techphantoms.pocketqa.storage.PocketQaRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * ExplorerAgent — bounded exploration; proposal-only (PRD §11.8).
 *
 * The agent runs inside the same OperationLock as replay so it can't overlap
 * with a capture or replay. It never mutates the approved library — the outcome
 * is a MissionSummary with an optional proposal that the user must approve
 * in a subsequent review step.
 */
class ExplorerAgent(
    private val ctx: ReactApplicationContext,
    private val repo: PocketQaRepository,
    private val policy: PolicyEngine,
    private val inference: InferenceRouter,
    private val tasks: TaskClient,
) {
    private val scope = CoroutineScope(Dispatchers.Default)
    private val stopSignals = ConcurrentHashMap<String, Boolean>()

    fun start(missionId: String, promise: Promise) {
        val missionMap = repo.mission(missionId)
        val missionJson = JsonBridge.readableMapToJsonString(missionMap)
        val summary = JsonBridge.json.parseToJsonElement(missionJson).jsonObject
        val mission = summary["mission"]?.jsonObject
            ?: return promise.reject("MISSION_NOT_FOUND", "mission not found")

        OperationLock.acquire(OperationLock.Kind.MISSION, missionId)
        repo.beginActiveOperation("MISSION", missionId)
        stopSignals[missionId] = false
        promise.resolve(null)

        scope.launch { runMission(missionId, mission) }
    }

    fun stop(missionId: String) { stopSignals[missionId] = true }

    // ---------- core loop ----------

    private suspend fun runMission(missionId: String, mission: JsonObject) {
        val packageName = mission["packageAllowlist"]?.jsonArray?.firstOrNull()?.jsonPrimitive?.contentOrNull.orEmpty()
        val maxActions = mission["maxActions"]?.jsonPrimitive?.content?.toIntOrNull() ?: 5
        val maxSeconds = mission["maxDurationSeconds"]?.jsonPrimitive?.content?.toIntOrNull() ?: 90
        val startedAt = System.currentTimeMillis()
        val events = mutableListOf<JsonObject>()

        events += ev("plan", "Explore ${packageName} within budget of $maxActions actions.")
        emitProgress(missionId, 0, maxActions, maxSeconds, "Observing…")

        launchTarget(packageName)
        delay(300)

        var actions = 0
        val visitedNodeIds = mutableSetOf<String>()
        var proposal: JsonObject? = null
        var proposalStateId: String? = null

        while (actions < maxActions) {
            if (stopSignals[missionId] == true) { events += ev("stop", "User stop."); break }
            val elapsedSeconds = ((System.currentTimeMillis() - startedAt) / 1000).toInt()
            if (elapsedSeconds >= maxSeconds) { events += ev("stop", "Time budget exhausted."); break }
            if (!policy.inAllowlist(packageName)) {
                events += ev("policy-block", "Package boundary violation — $packageName.")
                break
            }

            val snapshot = CaptureCoordinator.snapshotNow(packageName, "explore")
            if (snapshot == null) {
                events += ev("stop", "Accessibility service unavailable.")
                break
            }
            repo.persistUIState(snapshot.stateId, packageName, "explore", snapshot.payload)
            val state = JsonBridge.json.parseToJsonElement(snapshot.payload).jsonObject
            events += ev("observe", "Observed ${state["nodes"]?.jsonArray?.size ?: 0} nodes.")

            val candidates = eligibleTargets(state, visitedNodeIds)
            if (candidates.isEmpty()) {
                events += ev("stop", "No fresh eligible targets remain.")
                proposal = buildProposal(state, snapshot.stateId, mission)
                proposalStateId = snapshot.stateId
                break
            }
            val goal = mission["goal"]?.jsonPrimitive?.contentOrNull.orEmpty()
            val ranked = rankCandidates(candidates, missionId, goal, maxActions - actions)
            if (ranked.isEmpty()) {
                events += ev("stop", "Model requested early stop.")
                proposal = buildProposal(state, snapshot.stateId, mission)
                proposalStateId = snapshot.stateId
                break
            }
            val next = ranked.first()
            val nextNodeId = next["nodeId"]?.jsonPrimitive?.contentOrNull ?: break
            visitedNodeIds += nextNodeId

            events += ev("action", "Tapping ${next["text"]?.jsonPrimitive?.contentOrNull ?: nextNodeId}.")
            val ok = try { CaptureCoordinator.performClick(nextNodeId) } catch (_: Throwable) { false }
            actions++
            if (!ok) {
                events += ev("stop", "Action refused — hard stop.")
                break
            }
            emitProgress(missionId, actions, maxActions,
                maxSeconds - ((System.currentTimeMillis() - startedAt) / 1000).toInt(),
                "Explored ${next["text"]?.jsonPrimitive?.contentOrNull ?: nextNodeId}")
            delay(200)
        }

        // Build a proposal from whatever state we ended on, if we didn't already.
        if (proposal == null) {
            val finalSnap = CaptureCoordinator.snapshotNow(packageName, "explore")
            if (finalSnap != null) {
                repo.persistUIState(finalSnap.stateId, packageName, "explore", finalSnap.payload)
                val finalObj = JsonBridge.json.parseToJsonElement(finalSnap.payload).jsonObject
                proposal = buildProposal(finalObj, finalSnap.stateId, mission)
                proposalStateId = finalSnap.stateId
            }
        }

        events += ev("propose",
            if (proposal != null) "Proposed candidate assertions from discovered state."
            else "No proposal — mission ended without new evidence.")

        val summary = buildJsonObject {
            put("mission", mission)
            put("events", JsonArray(events))
            if (proposal != null) put("proposal", proposal!!)
        }
        // Persist the summary so a subsequent getMission() call after
        // MISSION_FINISHED can return the events + proposal.
        repo.writeMissionSummary(missionId, summary.toString())
        emitFinished(missionId, summary)
        OperationLock.release(OperationLock.Kind.MISSION, missionId)
        repo.endActiveOperation()
        stopSignals.remove(missionId)
    }

    // ---------- helpers ----------

    private fun eligibleTargets(state: JsonObject, visited: Set<String>): List<JsonObject> {
        val nodes = state["nodes"]?.jsonArray?.map { it.jsonObject } ?: return emptyList()
        return nodes.filter { n ->
            n["visible"]?.jsonPrimitive?.contentOrNull == "true" &&
                n["enabled"]?.jsonPrimitive?.contentOrNull == "true" &&
                n["sensitive"]?.jsonPrimitive?.contentOrNull != "true" &&
                (n["nodeId"]?.jsonPrimitive?.contentOrNull !in visited) &&
                (n["role"]?.jsonPrimitive?.contentOrNull in listOf("button", "checkbox", "switch")) &&
                !policy.isBlockedCategory(n["text"]?.jsonPrimitive?.contentOrNull) &&
                !policy.isBlockedCategory(n["contentDescription"]?.jsonPrimitive?.contentOrNull)
        }
    }

    /**
     * AI-6 rank_explorer_candidate — the model narrows a safe set, it never
     * widens one. Every candidate handed here has already been classified by
     * PolicyEngine as allowlisted, visible, non-sensitive. The model can
     * return a re-ordering that is a *subset* of these IDs; anything
     * unfamiliar is rejected server-side and we fall back to the deterministic
     * ordering. The model may also return `stopEarly: true`, which we honour
     * as an immediate STOP — the caller checks the returned list emptiness.
     */
    private suspend fun rankCandidates(
        candidates: List<JsonObject>,
        missionId: String,
        goal: String,
        remainingActions: Int,
    ): List<JsonObject> {
        val ids = candidates.mapNotNull { it["nodeId"]?.jsonPrimitive?.contentOrNull }
        if (ids.isEmpty()) return emptyList()

        val request = buildJsonObject {
            put("goal", JsonPrimitive(goal))
            put("stateSummary", JsonPrimitive(
                candidates.mapNotNull { it["text"]?.jsonPrimitive?.contentOrNull }
                    .take(5).joinToString(" · ")
            ))
            put("safeCandidates", buildJsonArray {
                for (c in candidates) add(buildJsonObject {
                    put("proposalId", c["nodeId"] ?: JsonPrimitive(""))
                    put("label", c["text"] ?: c["contentDescription"] ?: JsonPrimitive("Control"))
                    put("risk", JsonPrimitive("LOW"))
                    put("novelty", JsonPrimitive(1.0))
                    put("reversibleLikelihood", JsonPrimitive(0.8))
                    put("selectorStability", JsonPrimitive(
                        if (c["testId"] != null || c["resourceId"] != null) 0.95 else 0.7
                    ))
                    put("visitCount", JsonPrimitive(0))
                })
            })
            put("remainingActions", JsonPrimitive(remainingActions.coerceIn(0, 5)))
        }
        val result = tasks.run(
            taskId = "rank_explorer_candidate",
            request = request,
            consent = ConsentToken.GrantedForOperation("rank_explorer_candidate", missionId),
            timeoutMs = 5_000,
        )
        val choice = result.value?.get("choice")?.jsonPrimitive?.contentOrNull
        if (choice == "STOP") return emptyList()
        val orderedIds = if (choice != null) {
            listOf(choice) + ids.filter { it != choice }
        } else inference.rankCandidates("explore next", ids)
        // Never widen the set: reject any id we didn't offer.
        val allowed = ids.toSet()
        val filtered = orderedIds.filter { it in allowed }
        val byId = candidates.associateBy { it["nodeId"]?.jsonPrimitive?.contentOrNull }
        return filtered.mapNotNull { byId[it] }.ifEmpty { candidates }
    }

    private fun buildProposal(state: JsonObject, stateId: String, mission: JsonObject): JsonObject {
        val visible = state["nodes"]?.jsonArray
            ?.map { it.jsonObject }
            ?.filter { it["visible"]?.jsonPrimitive?.contentOrNull == "true" &&
                       it["sensitive"]?.jsonPrimitive?.contentOrNull != "true" }
            ?.mapNotNull { it["text"]?.jsonPrimitive?.contentOrNull }
            ?.take(3) ?: emptyList()
        val candidateAssertions = buildJsonArray {
            for (text in visible) {
                add(buildJsonObject {
                    put("id", JsonPrimitive("assert_" + UUID.randomUUID().toString().take(8)))
                    put("kind", JsonPrimitive("textVisible"))
                    put("target", JsonPrimitive(text))
                    put("expected", JsonPrimitive(text))
                    put("sourceStateId", JsonPrimitive(stateId))
                    put("supported", JsonPrimitive(true))
                    put("reason", JsonPrimitive("Discovered during exploration."))
                })
            }
        }
        return buildJsonObject {
            put("discoveredStateId", JsonPrimitive(stateId))
            put("candidateAssertions", candidateAssertions)
            put("summary", JsonPrimitive(
                "Explored ${mission["goal"]?.jsonPrimitive?.contentOrNull.orEmpty()} — " +
                    "found ${visible.size} candidate assertion${if (visible.size == 1) "" else "s"}."
            ))
        }
    }

    private fun ev(kind: String, message: String): JsonObject = buildJsonObject {
        put("at", JsonPrimitive(System.currentTimeMillis()))
        put("kind", JsonPrimitive(kind))
        put("message", JsonPrimitive(message))
    }

    private fun launchTarget(packageName: String) {
        val launch = ctx.packageManager.getLaunchIntentForPackage(packageName) ?: return
        launch.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(launch)
    }

    private fun emitProgress(
        missionId: String, actionsTaken: Int, actionsMax: Int,
        secondsRemaining: Int, label: String,
    ) {
        val payload = Arguments.createMap()
        payload.putString("missionId", missionId)
        payload.putInt("actionsTaken", actionsTaken)
        payload.putInt("actionsMax", actionsMax)
        payload.putInt("secondsRemaining", secondsRemaining)
        payload.putString("latestEventLabel", label)
        sendEvent("MISSION_PROGRESS", payload)
    }

    private fun emitFinished(missionId: String, summary: JsonObject) {
        val payload = JsonBridge.toWritableMap(summary.toString())
        sendEvent("MISSION_FINISHED", payload)
    }

    private fun sendEvent(type: String, payload: WritableMap) {
        val envelope = Arguments.createMap()
        envelope.putString("type", type)
        envelope.putMap("payload", payload)
        ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("PocketQaEvent", envelope)
    }
}
