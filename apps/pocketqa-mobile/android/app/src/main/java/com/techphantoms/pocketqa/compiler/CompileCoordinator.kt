package com.techphantoms.pocketqa.compiler

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.techphantoms.pocketqa.inference.ConsentToken
import com.techphantoms.pocketqa.inference.InferenceRouter
import com.techphantoms.pocketqa.inference.TaskClient
import com.techphantoms.pocketqa.storage.PocketQaRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * CompileCoordinator — orchestrates the compile pipeline.
 *
 * Stages (see §7.8):
 *   1. finalising evidence
 *   2. redacting sensitive content
 *   3. building selectors (deterministic first)
 *   4. deriving assertions
 *   5. optional on-device AI ranking (falls back on invalid output)
 *   6. validating the resulting draft against the canonical schema
 *
 * The deterministic path lives in Kotlin here; the inference call is best-effort
 * and always falls back to the deterministic output when the model isn't
 * available or emits a fabricated ID.
 */
class CompileCoordinator(
    private val repo: PocketQaRepository,
    private val inference: InferenceRouter,
    private val tasks: TaskClient,
) {
    fun compile(sessionId: String): String {
        val engine = when (inference.currentEngine()) {
            InferenceRouter.Engine.ON_DEVICE_AI -> "on-device-ai"
            InferenceRouter.Engine.CONNECTED_ASSIST -> "connected-assist"
            InferenceRouter.Engine.DETERMINISTIC_LOCAL -> "deterministic-local"
        }
        val jobId = repo.compileFromSession(sessionId, engine)
        // Ask the task service to propose a name + curated final-assertions.
        // Every call degrades to the deterministic path (untouched draft) on
        // failure, timeout, or when the endpoint isn't configured (§3.1).
        val draftId = repo.draftIdForJob(jobId) ?: return jobId
        runBlocking {
            // Concurrent so a slow / dead endpoint doesn't stall the bridge
            // for the sum of the two timeouts. Total worst case ~4s.
            awaitAll(
                async { proposeName(draftId) },
                async { proposeFinalAssertions(draftId) },
            )
        }
        return jobId
    }

    /**
     * AI-3 name_test — pre-fill draft.name with a human-legible title. The
     * caller edits it in review; approving locks the name into the immutable
     * artefact. If the model is unavailable the draft keeps its intent-based
     * prefix (today's behaviour).
     */
    private suspend fun proposeName(draftId: String) {
        val draft = repo.readDraftJson(draftId) ?: return
        val intent = draft["intent"]?.jsonPrimitive?.contentOrNull ?: return
        if (intent.length < 10) return
        val existing = draft["name"]?.jsonPrimitive?.contentOrNull
        // Never rename a draft the user already edited past the auto-fill.
        if (!existing.isNullOrBlank() && existing != intent && existing != "Untitled" &&
            !existing.startsWith("draft_")) return
        val request = buildJsonObject {
            put("intent", JsonPrimitive(intent))
            put("stepCount", JsonPrimitive(draft["steps"]?.jsonArray?.size ?: 0))
            put("packageName", draft["packageName"] ?: JsonPrimitive(""))
        }
        val result = tasks.run(
            taskId = "name_test",
            request = request,
            consent = ConsentToken.GrantedForOperation("name_test", draftId),
            timeoutMs = 2_000,
        )
        val name = result.value?.get("name")?.jsonPrimitive?.contentOrNull
        if (!name.isNullOrBlank() && name.length in 3..80) {
            repo.applyAiName(draftId, name, result.provenance.toJsonObject())
        }
    }

    /**
     * AI-2 compile_intent + rank_assertions — pick from the deterministic
     * candidate pool (never invent) and order what survives. Rendered as
     * pre-checked proposals inside the existing approval gate (see review UI).
     */
    private suspend fun proposeFinalAssertions(draftId: String) {
        val draft = repo.readDraftJson(draftId) ?: return
        val intent = draft["intent"]?.jsonPrimitive?.contentOrNull ?: return
        val candidates = repo.candidateAssertionsForDraft(draftId)
        if (candidates.isEmpty()) return

        val request = buildJsonObject {
            put("intent", JsonPrimitive(intent))
            put("candidates", JsonArray(candidates))
        }
        val compileRes = tasks.run(
            taskId = "compile_intent",
            request = request,
            consent = ConsentToken.GrantedForOperation("compile_intent", draftId),
            timeoutMs = 4_000,
        )
        val allowed = compileRes.value?.get("selectedIds")?.jsonArray
            ?.mapNotNull { it.jsonPrimitive.contentOrNull }
            ?.toSet()
            ?: return
        val filtered = candidates.filter {
            it["id"]?.jsonPrimitive?.contentOrNull in allowed
        }
        if (filtered.isEmpty()) return

        val rankReq = buildJsonObject {
            put("intent", JsonPrimitive(intent))
            put("candidates", JsonArray(filtered))
        }
        val rankRes = tasks.run(
            taskId = "rank_assertions",
            request = rankReq,
            consent = ConsentToken.GrantedForOperation("rank_assertions", draftId),
            timeoutMs = 2_000,
        )
        val orderedIds = rankRes.value?.get("orderedIds")?.jsonArray
            ?.mapNotNull { it.jsonPrimitive.contentOrNull }
            ?: filtered.mapNotNull { it["id"]?.jsonPrimitive?.contentOrNull }

        val byId = filtered.associateBy { it["id"]!!.jsonPrimitive.content }
        val ranked = orderedIds.mapNotNull { byId[it] }
        // Combine both provenance dicts so the review UI can attribute both
        // the selection and the ordering (usedModel bit ORs to true when any
        // stage actually ran on the server).
        val combined = buildJsonObject {
            put("selection", compileRes.provenance.toJsonObject())
            put("ranking", rankRes.provenance.toJsonObject())
            put("usedModel", JsonPrimitive(
                compileRes.provenance.usedModel || rankRes.provenance.usedModel
            ))
        }
        repo.applyAiFinalAssertionProposals(draftId, ranked, combined)
    }

    fun job(id: String): WritableMap = repo.getCompileJob(id)
    fun cancelAi(id: String) { /* cancel any in-flight on-device inference */ }
    fun validate(id: String): WritableMap {
        val draft = repo.draft(id)
        val map = Arguments.createMap()
        val errors = Arguments.createArray()
        val warnings = Arguments.createArray()
        val steps = if (draft.hasKey("steps")) draft.getArray("steps") else null
        val stepCount = steps?.size() ?: 0
        if (stepCount == 0) errors.pushString("Draft has no steps.")
        val finalAssertions = if (draft.hasKey("finalAssertions")) draft.getArray("finalAssertions") else null
        if ((finalAssertions?.size() ?: 0) == 0) {
            errors.pushString("At least one end-state assertion is required.")
        }
        map.putBoolean("valid", errors.size() == 0)
        map.putArray("errors", errors)
        map.putArray("warnings", warnings)
        return map
    }
}
