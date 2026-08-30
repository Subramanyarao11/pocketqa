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
            // Concurrent so a slow or dead endpoint costs the larger of the two
            // budgets rather than their sum. Worst case is therefore the
            // longest single call, currently 7s — not the ~4s an earlier note
            // here claimed, which had drifted from the timeouts actually passed.
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
            put("stepLabels", buildJsonArray {
                draft["steps"]?.jsonArray?.forEach { step ->
                    step.jsonObject["label"]?.let(::add)
                }
            })
            put("observedFacts", buildJsonArray {
                repo.candidateAssertionsForDraft(draftId).take(8).forEach { candidate ->
                    add(buildJsonObject {
                        put("id", candidate["id"] ?: JsonPrimitive(""))
                        put("fact", JsonPrimitive(candidateFact(candidate)))
                    })
                }
            })
            put("assertionCount", JsonPrimitive(draft["finalAssertions"]?.jsonArray?.size ?: 0))
        }
        val result = tasks.run(
            taskId = "name_test",
            request = request,
            consent = ConsentToken.GrantedForOperation("name_test", draftId),
            timeoutMs = 5_000,
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

        val allowedIds = candidates.mapNotNull { it["id"]?.jsonPrimitive?.contentOrNull }
        val serviceCandidates = candidates.map { candidate ->
            val target = candidate["target"]?.jsonPrimitive?.contentOrNull.orEmpty()
            buildJsonObject {
                put("id", candidate["id"] ?: JsonPrimitive(""))
                put("fact", JsonPrimitive(candidateFact(candidate)))
                put("sourceStateId", candidate["sourceStateId"] ?: JsonPrimitive(""))
                put("allowedKinds", buildJsonArray {
                    add(JsonPrimitive("VISIBLE"))
                    add(JsonPrimitive("TEXT_CONTAINS"))
                })
                put("observedValue", JsonPrimitive(target))
                put("selectorLabel", JsonPrimitive(target))
                put("isEndState", JsonPrimitive(true))
            }
        }

        val request = buildJsonObject {
            put("intentText", JsonPrimitive(intent))
            put("targetPackage", draft["packageName"] ?: JsonPrimitive(""))
            put("candidates", JsonArray(serviceCandidates))
            put("allowedCandidateIds", buildJsonArray {
                allowedIds.forEach { add(JsonPrimitive(it)) }
            })
            put("maxAssertions", JsonPrimitive(4))
        }
        val compileRes = tasks.run(
            taskId = "compile_intent",
            request = request,
            consent = ConsentToken.GrantedForOperation("compile_intent", draftId),
            timeoutMs = 7_000,
        )
        // A failed or timed-out call is also an answer the operator is owed. This
        // returned silently, so a request that never came back looked exactly
        // like a fully offline compile — the third place the same gap hid, after
        // the empty-selection branch below. Record that we asked, then stop.
        val selected = compileRes.value?.get("selected")?.jsonArray
            ?.map { it.jsonObject }
            ?: run {
                // Only when a request actually went out. With no endpoint
                // configured the provenance is the deterministic one and
                // networkUsed is false — recording that would claim we tried
                // when nothing was ever attempted, which is the same lie in the
                // opposite direction.
                if (compileRes.provenance.networkUsed) {
                    repo.applyAiFinalAssertionProposals(
                        draftId,
                        emptyList(),
                        buildJsonObject {
                            put("selection", compileRes.provenance.toJsonObject())
                            put("usedModel", JsonPrimitive(compileRes.provenance.usedModel))
                        },
                    )
                }
                return
            }
        val selectedById = selected.associateBy {
            it["candidateId"]?.jsonPrimitive?.contentOrNull.orEmpty()
        }
        val filtered = candidates.mapNotNull { candidate ->
            val id = candidate["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val proposal = selectedById[id] ?: return@mapNotNull null
            JsonObject(candidate + mapOf(
                "confidence" to (proposal["confidence"] ?: JsonPrimitive(0.0)),
                "serviceKind" to (proposal["kind"] ?: JsonPrimitive("VISIBLE")),
            ))
        }
        if (filtered.isEmpty()) {
            // The model ran and selected nothing — which it does honestly when
            // the evidence does not support the intent, and which redaction can
            // cause by stripping the intent itself. Returning here left no
            // record that we asked, so review showed the same "add an
            // assertion" prompt as a fully offline compile and the operator had
            // no way to tell the two apart.
            repo.applyAiFinalAssertionProposals(
                draftId,
                emptyList(),
                buildJsonObject {
                    put("selection", compileRes.provenance.toJsonObject())
                    put("usedModel", JsonPrimitive(compileRes.provenance.usedModel))
                },
            )
            return
        }

        val rankReq = buildJsonObject {
            put("intent", JsonPrimitive(intent))
            put("candidates", buildJsonArray {
                filtered.forEach { candidate ->
                    add(buildJsonObject {
                        put("id", candidate["id"] ?: JsonPrimitive(""))
                        put("kind", candidate["serviceKind"] ?: JsonPrimitive("VISIBLE"))
                        put("fact", JsonPrimitive(candidateFact(candidate)))
                        put("sourceStateId", candidate["sourceStateId"] ?: JsonPrimitive(""))
                        put("isEndState", JsonPrimitive(true))
                    })
                }
            })
            put("allowedCandidateIds", buildJsonArray {
                filtered.forEach { candidate ->
                    candidate["id"]?.let(::add)
                }
            })
        }
        val rankRes = tasks.run(
            taskId = "rank_assertions",
            request = rankReq,
            consent = ConsentToken.GrantedForOperation("rank_assertions", draftId),
            timeoutMs = 5_000,
        )
        val orderedIds = rankRes.value?.get("ranked")?.jsonArray
            ?.mapNotNull { it.jsonObject["candidateId"]?.jsonPrimitive?.contentOrNull }
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

    private fun candidateFact(candidate: JsonObject): String {
        val target = candidate["target"]?.jsonPrimitive?.contentOrNull.orEmpty()
        return "Text '$target' visible in the final observed state"
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
