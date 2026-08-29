package com.techphantoms.pocketqa.storage

import android.accessibilityservice.AccessibilityServiceInfo
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Room-backed persistence + readiness/policy queries.
 *
 * The React Native façade never receives raw AccessibilityNodeInfo or provider
 * keys; those are shredded before entering Room and re-hydrated as
 * schema-shaped payloads on the way out.
 *
 * Bridge methods are `runBlocking` on the DAO because the React Native bridge
 * expects synchronous returns from `@ReactMethod` calls. Every Room operation
 * runs on Room's own executor, so this only blocks the bridge thread.
 */
class PocketQaRepository(private val ctx: ReactApplicationContext) {

    private val db = PocketQaDatabase.get(ctx)
    private val dao get() = db.dao()
    private val prefs = ctx.getSharedPreferences("pocketqa.settings", 0)
    private val allowlist = listOf("com.techphantoms.pocketqa.demoshop")

    data class Session(val id: String, val packageName: String)

    // -- Readiness -----------------------------------------------------------------

    fun startupState(): WritableMap = runBlocking {
        val map = Arguments.createMap()
        val consented = dao.consent() != null
        map.putBoolean("onboardingComplete", consented && accessibilityEnabled())
        map.putMap("readiness", readiness())
        val active = dao.activeOp()
        if (active != null) {
            val op = Arguments.createMap()
            op.putString("kind", active.kind)
            op.putString("id", active.operationId)
            map.putMap("activeOperation", op)
        }
        map
    }

    fun readiness(): WritableMap = runBlocking {
        val map = Arguments.createMap()
        map.putBoolean("consented", dao.consent() != null)
        map.putBoolean("accessibilityEnabled", accessibilityEnabled())
        map.putBoolean("screenshotSupported", true)
        map.putBoolean("storageOk", ctx.filesDir.freeSpace > 20 * 1024 * 1024)
        map.putBoolean("microphoneReady", false)
        map.putBoolean("demoShopInstalled", demoShopInstalled())
        map.putString("onDeviceModel", "unavailable")
        map.putBoolean("offlineMode", prefs.getBoolean("offlineMode", true))
        val connected = Arguments.createMap()
        val providers = dao.providers().associateBy { it.provider }
        for (p in listOf("sarvam", "openai")) {
            val row = providers[p]
            val entry = Arguments.createMap()
            entry.putBoolean("configured", row != null)
            if (row?.maskedKey != null) entry.putString("maskedKey", row.maskedKey)
            connected.putMap(p, entry)
        }
        map.putMap("connected", connected)
        val al = Arguments.createArray(); for (pkg in allowlist) al.pushString(pkg)
        map.putArray("packageAllowlist", al)
        map
    }

    fun setOfflineMode(offline: Boolean) {
        prefs.edit().putBoolean("offlineMode", offline).apply()
    }

    fun recordConsent() = runBlocking {
        dao.upsertConsent(ConsentRow(id = "default", version = 1, grantedAt = System.currentTimeMillis()))
    }

    // -- Intents + sessions --------------------------------------------------------

    fun createIntent(input: ReadableMap): WritableMap = runBlocking {
        val id = "intent_" + UUID.randomUUID().toString().take(8)
        val payload = JsonBridge.readableMapToJsonString(input)
        val enriched = mergeJson(payload, buildJsonObject { put("intentId", id) })
        dao.upsertIntent(IntentRow(
            id = id,
            packageName = input.optString("packageName"),
            fixture = if (input.hasKey("fixture")) input.getString("fixture") else null,
            payload = enriched,
            createdAt = System.currentTimeMillis(),
        ))
        Arguments.createMap().apply { putString("intentId", id) }
    }

    fun startSession(intentId: String, fixture: String?): Session = runBlocking {
        val intent = dao.intent(intentId) ?: error("intent not found")
        val id = "sess_" + UUID.randomUUID().toString().take(8)
        val sessionRow = SessionRow(
            id = id, intentId = intentId,
            packageName = intent.packageName, state = "recording",
            stepCount = 0,
            startedAt = System.currentTimeMillis(),
            checkpointedAt = System.currentTimeMillis(),
        )
        dao.upsertSession(sessionRow)
        dao.upsertActiveOp(ActiveOperationRow(kind = "CAPTURE", operationId = id, checkpointedAt = sessionRow.startedAt))
        Session(id, sessionRow.packageName)
    }

    fun appendSimulatedEvent(sessionId: String, evt: ReadableMap) = runBlocking {
        val payload = JsonBridge.readableMapToJsonString(evt)
        dao.insertCaptureEvent(CaptureEventRow(
            id = "evt_" + UUID.randomUUID().toString().take(8),
            sessionId = sessionId,
            at = System.currentTimeMillis(),
            payload = payload,
        ))
        dao.incrementSessionStepCount(sessionId, System.currentTimeMillis())
    }

    fun pauseSession(id: String) = runBlocking {
        dao.updateSessionState(id, "paused", System.currentTimeMillis())
    }
    fun resumeSession(id: String) = runBlocking {
        dao.updateSessionState(id, "recording", System.currentTimeMillis())
    }
    fun cancelSession(id: String, deleteArtifacts: Boolean) = runBlocking {
        if (deleteArtifacts) dao.deleteEventsForSession(id)
        dao.deleteSession(id)
        dao.clearActiveOp()
    }

    // -- Compile / drafts ---------------------------------------------------------

    fun draft(id: String): WritableMap = runBlocking {
        dao.draft(id)?.payload?.let { JsonBridge.toWritableMap(it) } ?: Arguments.createMap()
    }

    fun saveDraft(req: ReadableMap): WritableMap = runBlocking {
        val draftId = req.getString("draftId") ?: error("draftId required")
        val current = dao.draft(draftId)?.payload
            ?.let { JsonBridge.json.parseToJsonElement(it).jsonObject }
            ?: buildJsonObject { put("id", draftId) }
        val patch = req.getMap("patch")?.let { JsonBridge.json.parseToJsonElement(JsonBridge.readableMapToJsonString(it)).jsonObject }
            ?: JsonObject(emptyMap())
        val merged = JsonObject(current + patch)
        dao.upsertDraft(TestDraftRow(
            id = draftId,
            name = merged["name"]?.jsonPrimitive?.contentOrNull ?: "Untitled",
            packageName = merged["packageName"]?.jsonPrimitive?.contentOrNull ?: "",
            payload = merged.toString(),
            revision = (dao.draft(draftId)?.revision ?: 0) + 1,
            updatedAt = System.currentTimeMillis(),
        ))
        JsonBridge.toWritableMap(merged.toString())
    }

    fun approveDraft(id: String): WritableMap = runBlocking {
        val row = dao.draft(id) ?: error("draft not found")
        val payload = JsonBridge.json.parseToJsonElement(row.payload).jsonObject
        val approvedPayload = buildJsonObject {
            for ((k, v) in payload) put(k, v)
            put("schemaVersion", JsonPrimitive("pocketqa/approved-test@1"))
            put("version", JsonPrimitive(1))
            put("approvedAt", JsonPrimitive(System.currentTimeMillis()))
            put("schemaHash", JsonPrimitive(djb2(row.payload)))
        }
        dao.upsertApprovedTest(ApprovedTestRow(
            id = id, version = 1, name = row.name,
            packageName = row.packageName,
            compiledBy = payload["compiledBy"]?.jsonPrimitive?.contentOrNull ?: "deterministic-local",
            payload = approvedPayload.toString(),
            schemaHash = djb2(row.payload),
            approvedAt = System.currentTimeMillis(),
        ))
        dao.deleteDraft(id)
        JsonBridge.toWritableMap(approvedPayload.toString())
    }

    // -- Tests + runs -------------------------------------------------------------

    fun listTests(): WritableArray = runBlocking {
        val arr = Arguments.createArray()
        for (t in dao.allApproved()) {
            val latestRun = dao.latestRunForTest(t.id)
            val item = Arguments.createMap()
            item.putString("id", t.id)
            item.putInt("version", t.version)
            item.putString("name", t.name)
            item.putString("packageName", t.packageName)
            item.putString("compiledBy", t.compiledBy)
            if (latestRun != null) item.putBoolean("lastRunPassed", latestRun.passed)
            arr.pushMap(item)
        }
        arr
    }

    fun getTest(id: String, version: Int?): WritableMap = runBlocking {
        val row = if (version != null) dao.approvedAt(id, version) else dao.latestApproved(id)
        row?.payload?.let { JsonBridge.toWritableMap(it) } ?: Arguments.createMap()
    }

    fun run(id: String): WritableMap = runBlocking {
        dao.run(id)?.payload?.let { JsonBridge.toWritableMap(it) } ?: Arguments.createMap()
    }

    fun evidenceTimeline(id: String): WritableArray = runBlocking {
        val row = dao.run(id) ?: return@runBlocking Arguments.createArray()
        val payload = JsonBridge.json.parseToJsonElement(row.payload).jsonObject
        val test = payload["test"]?.jsonObject ?: return@runBlocking Arguments.createArray()
        val steps = test["steps"]?.jsonArray ?: return@runBlocking Arguments.createArray()
        val stepResults = payload["result"]?.jsonObject?.get("stepResults")?.jsonArray ?: JsonArray(emptyList())
        val out = Arguments.createArray()
        val stateIds = mutableSetOf<String>()
        for (s in steps) {
            val obj = s.jsonObject
            stateIds += obj["beforeStateId"]?.jsonPrimitive?.contentOrNull.orEmpty()
            stateIds += obj["afterStateId"]?.jsonPrimitive?.contentOrNull.orEmpty()
        }
        val states = dao.uiStatesForIds(stateIds.filter { it.isNotEmpty() }).associateBy { it.id }
        for (s in steps) {
            val entry = Arguments.createMap()
            entry.putMap("step", JsonBridge.toWritableMap(s.toString()))
            val stepId = s.jsonObject["id"]?.jsonPrimitive?.contentOrNull
            val result = stepResults.firstOrNull { it.jsonObject["stepId"]?.jsonPrimitive?.contentOrNull == stepId }
            if (result != null) entry.putMap("result", JsonBridge.toWritableMap(result.toString()))
            val before = states[s.jsonObject["beforeStateId"]?.jsonPrimitive?.contentOrNull]
            val after = states[s.jsonObject["afterStateId"]?.jsonPrimitive?.contentOrNull]
            if (before != null) entry.putMap("beforeState", JsonBridge.toWritableMap(before.payload))
            if (after != null) entry.putMap("afterState", JsonBridge.toWritableMap(after.payload))
            out.pushMap(entry)
        }
        out
    }

    // -- Missions -----------------------------------------------------------------

    fun createMission(input: ReadableMap): WritableMap = runBlocking {
        val id = "mission_" + UUID.randomUUID().toString().take(8)
        val payload = mergeJson(JsonBridge.readableMapToJsonString(input), buildJsonObject {
            put("id", id)
            put("allowedTools", buildJsonArray {
                add(JsonPrimitive("observe")); add(JsonPrimitive("tapNode"))
                add(JsonPrimitive("back")); add(JsonPrimitive("waitForIdle"))
                add(JsonPrimitive("stop"))
            })
        })
        dao.upsertMission(MissionRow(
            id = id, goal = input.optString("goal"),
            payload = payload, summaryPayload = null,
            createdAt = System.currentTimeMillis(),
        ))
        JsonBridge.toWritableMap(payload)
    }

    fun mission(id: String): WritableMap = runBlocking {
        val row = dao.mission(id) ?: return@runBlocking Arguments.createMap()
        val out = Arguments.createMap()
        out.putMap("mission", JsonBridge.toWritableMap(row.payload))
        val summary = row.summaryPayload
        if (summary != null) {
            val el = JsonBridge.json.parseToJsonElement(summary).jsonObject
            el["events"]?.let { out.putArray("events", JsonBridge.toWritableArray(it.jsonArray.map { e -> e.toString() })) }
            el["proposal"]?.let { out.putMap("proposal", JsonBridge.toWritableMap(it.toString())) }
        } else {
            out.putArray("events", Arguments.createArray())
        }
        out
    }

    // -- Selector candidates + failure detective (§7.9, §7.11) --------------------

    fun uiState(stateId: String): WritableMap? = runBlocking {
        dao.uiState(stateId)?.payload?.let { JsonBridge.toWritableMap(it) }
    }

    fun selectorCandidates(draftId: String, stepId: String): WritableArray = runBlocking {
        val draftRow = dao.draft(draftId) ?: return@runBlocking Arguments.createArray()
        val draft = JsonBridge.json.parseToJsonElement(draftRow.payload).jsonObject
        val step = draft["steps"]?.jsonArray
            ?.map { it.jsonObject }
            ?.firstOrNull { it["id"]?.jsonPrimitive?.contentOrNull == stepId }
            ?: return@runBlocking Arguments.createArray()
        val selector = step["selector"]?.jsonObject ?: return@runBlocking Arguments.createArray()
        val candidates = mutableListOf<JsonObject>()
        selector["primary"]?.jsonObject?.let { candidates += it }
        selector["fallbacks"]?.jsonArray?.forEach { candidates += it.jsonObject }
        val out = Arguments.createArray()
        for ((i, c) in candidates.withIndex()) {
            val map = Arguments.createMap()
            map.putInt("index", i)
            map.putString("strategy", c["strategy"]?.jsonPrimitive?.contentOrNull.orEmpty())
            map.putString("value", c["value"]?.jsonPrimitive?.contentOrNull.orEmpty())
            map.putDouble("confidence", c["confidence"]?.jsonPrimitive?.content?.toDoubleOrNull() ?: 0.0)
            map.putString("reason", c["reason"]?.jsonPrimitive?.contentOrNull.orEmpty())
            c["role"]?.jsonPrimitive?.contentOrNull?.let { map.putString("role", it) }
            map.putBoolean("isPrimary", i == 0)
            out.pushMap(map)
        }
        out
    }

    fun promoteFallback(draftId: String, stepId: String, candidateIndex: Int): WritableMap = runBlocking {
        val draftRow = dao.draft(draftId) ?: error("draft not found")
        val draft = JsonBridge.json.parseToJsonElement(draftRow.payload).jsonObject
        val steps = draft["steps"]?.jsonArray ?: error("no steps")
        val newSteps = buildJsonArray {
            for (raw in steps) {
                val step = raw.jsonObject
                if (step["id"]?.jsonPrimitive?.contentOrNull != stepId) { add(raw); continue }
                val selector = step["selector"]?.jsonObject ?: run { add(raw); continue }
                val options = mutableListOf<JsonObject>()
                selector["primary"]?.jsonObject?.let { options += it }
                selector["fallbacks"]?.jsonArray?.forEach { options += it.jsonObject }
                if (candidateIndex !in options.indices) { add(raw); continue }
                val chosen = options[candidateIndex]
                val rest = options.filterIndexed { i, _ -> i != candidateIndex }
                    .filter { it["strategy"]?.jsonPrimitive?.contentOrNull != "coordinates" }
                    .take(2)
                val newSelector = buildJsonObject {
                    put("primary", chosen)
                    put("fallbacks", JsonArray(rest))
                    put("candidateCount", selector["candidateCount"] ?: JsonPrimitive(options.size))
                }
                val newStep = buildJsonObject {
                    for ((k, v) in step) put(k, v)
                    put("selector", newSelector)
                    put("needsHumanCorrection", JsonPrimitive(false))
                }
                add(newStep)
            }
        }
        val nextDraft = buildJsonObject {
            for ((k, v) in draft) if (k != "steps") put(k, v)
            put("steps", newSteps)
        }
        dao.upsertDraft(TestDraftRow(
            id = draftRow.id, name = draftRow.name, packageName = draftRow.packageName,
            payload = nextDraft.toString(), revision = draftRow.revision + 1,
            updatedAt = System.currentTimeMillis(),
        ))
        JsonBridge.toWritableMap(nextDraft.toString())
    }

    fun failureProposal(runId: String): WritableMap? = runBlocking {
        val runRow = dao.run(runId) ?: return@runBlocking null
        val payload = JsonBridge.json.parseToJsonElement(runRow.payload).jsonObject
        val result = payload["result"]?.jsonObject ?: return@runBlocking null
        val failure = result["failure"]?.jsonObject ?: return@runBlocking null
        val test = payload["test"]?.jsonObject ?: return@runBlocking null
        val category = failure["category"]?.jsonPrimitive?.contentOrNull ?: "unknown"
        val summary = failure["summary"]?.jsonPrimitive?.contentOrNull ?: ""
        val failingStepId = result["stepResults"]?.jsonArray
            ?.firstOrNull { it.jsonObject["status"]?.jsonPrimitive?.contentOrNull == "fail" }
            ?.jsonObject?.get("stepId")?.jsonPrimitive?.contentOrNull
        val failingStep = test["steps"]?.jsonArray
            ?.map { it.jsonObject }
            ?.firstOrNull { it["id"]?.jsonPrimitive?.contentOrNull == failingStepId }
        val out = Arguments.createMap()
        out.putString("runId", runId)
        if (failingStepId != null) out.putString("stepId", failingStepId)
        out.putString("category", category)
        out.putString("summary", summary)
        val suggestion = when (category) {
            "selector-drift" -> {
                val fallback = failingStep?.get("selector")?.jsonObject?.get("fallbacks")?.jsonArray?.firstOrNull()?.jsonObject
                if (fallback != null) {
                    val strategy = fallback["strategy"]?.jsonPrimitive?.contentOrNull.orEmpty()
                    val value = fallback["value"]?.jsonPrimitive?.contentOrNull.orEmpty()
                    val action = Arguments.createMap()
                    action.putString("kind", "promote-fallback")
                    action.putString("strategy", strategy)
                    action.putString("value", value)
                    out.putMap("action", action)
                    "Promote fallback selector $strategy=$value."
                } else "Re-record this step — no stable fallback selector is available."
            }
            "assertion-regression" -> "Verify the expected value still matches the intent, or update the assertion."
            "timeout-performance" -> {
                val action = Arguments.createMap()
                action.putString("kind", "add-wait"); action.putInt("ms", 500)
                out.putMap("action", action)
                "Add a short wait before this step or increase the idle timeout."
            }
            "environment-fixture" -> {
                val action = Arguments.createMap()
                action.putString("kind", "update-fixture"); action.putString("fixture", "reset")
                out.putMap("action", action)
                "Reset to a known fixture before replay."
            }
            "policy-hard-stop" -> "Policy blocked this action. Re-record so the step lands inside the allowlist."
            "navigation-divergence" -> "The screen diverged from what was captured. Re-record from the failing step."
            else -> "Open the evidence trail to inspect the failing state before repairing."
        }
        out.putString("suggestion", suggestion)
        out
    }

    fun checkpoint() = runBlocking {
        // Bump every "active" row's checkpointedAt so foreground rehydration can
        // resume the workflow at the last completed step.
        val op = dao.activeOp() ?: return@runBlocking
        dao.upsertActiveOp(op.copy(checkpointedAt = System.currentTimeMillis()))
    }

    // -- Providers + teardown -----------------------------------------------------

    fun saveProvider(input: ReadableMap): WritableMap = runBlocking {
        val provider = input.getString("provider") ?: error("provider required")
        val key = input.getString("key") ?: error("key required")
        val masked = "••••" + key.takeLast(4).uppercase()
        // NB: this scaffold stores an obfuscated form only; production wraps
        // `key.toByteArray()` with EncryptedSharedPreferences / MasterKey.
        val obfuscated = key.toByteArray().map { (it.toInt() xor 0x5A).toByte() }.toByteArray()
        dao.upsertProvider(ProviderRow(
            provider = provider, maskedKey = masked, encryptedKey = obfuscated,
            updatedAt = System.currentTimeMillis(),
        ))
        val out = Arguments.createMap()
        out.putString("provider", provider); out.putBoolean("configured", true); out.putString("maskedKey", masked)
        out
    }

    fun deleteProvider(provider: String) = runBlocking { dao.deleteProvider(provider) }
    fun deleteSession(id: String) = runBlocking { cancelSession(id, deleteArtifacts = true) }
    fun deleteTest(id: String) = runBlocking { dao.deleteApproved(id) }
    fun deleteAll() = runBlocking {
        dao.clearConsent(); dao.clearProviders(); dao.clearIntents()
        dao.clearSessions(); dao.clearEvents(); dao.clearStates()
        dao.clearJobs(); dao.clearDrafts(); dao.clearApproved()
        dao.clearRuns(); dao.clearMissions(); dao.clearActiveOp()
    }

    // -- Internal helpers ---------------------------------------------------------

    /** Runs the compile pipeline and persists both the job and the resulting draft. */
    fun compileFromSession(sessionId: String, engine: String): String = runBlocking {
        val session = dao.session(sessionId) ?: error("session not found")
        val intent = dao.intent(session.intentId)?.let {
            JsonBridge.json.parseToJsonElement(it.payload).jsonObject
        } ?: buildJsonObject { put("intent", "") }
        val events = dao.eventsForSession(sessionId).map {
            JsonBridge.json.parseToJsonElement(it.payload).jsonObject
        }
        val jobId = "compile_" + UUID.randomUUID().toString().take(8)
        val draftId = "draft_" + UUID.randomUUID().toString().take(8)
        val steps = buildJsonArray {
            for ((i, ev) in events.withIndex()) {
                add(buildJsonObject {
                    put("id", JsonPrimitive("step_$i"))
                    put("order", JsonPrimitive(i))
                    put("action", ev["action"] ?: JsonPrimitive("tap"))
                    put("label", ev["label"] ?: JsonPrimitive("Step ${i + 1}"))
                    ev["input"]?.let { put("input", it) }
                    put("assertions", JsonArray(emptyList()))
                    put("beforeStateId", JsonPrimitive("s_before_$i"))
                    put("afterStateId", JsonPrimitive("s_after_$i"))
                    put("needsHumanCorrection", JsonPrimitive(false))
                })
            }
        }
        val draftPayload = buildJsonObject {
            put("schemaVersion", JsonPrimitive("pocketqa/test-draft@1"))
            put("id", JsonPrimitive(draftId))
            put("name", intent["intent"] ?: JsonPrimitive("Untitled test"))
            put("intent", intent["intent"] ?: JsonPrimitive(""))
            put("packageName", JsonPrimitive(session.packageName))
            put("compiledBy", JsonPrimitive(engine))
            put("createdAt", JsonPrimitive(System.currentTimeMillis()))
            put("steps", steps)
            put("finalAssertions", JsonArray(emptyList()))
            put("offlineOnly", JsonPrimitive(engine == "deterministic-local"))
        }
        dao.upsertDraft(TestDraftRow(
            id = draftId, name = "Untitled", packageName = session.packageName,
            payload = draftPayload.toString(), revision = 1,
            updatedAt = System.currentTimeMillis(),
        ))
        dao.upsertCompileJob(CompileJobRow(
            jobId = jobId, sessionId = sessionId, engine = engine, finished = true,
            payload = buildJsonObject {
                put("jobId", JsonPrimitive(jobId))
                put("engine", JsonPrimitive(engine))
                put("finished", JsonPrimitive(true))
            }.toString(),
            draftId = draftId,
            createdAt = System.currentTimeMillis(),
        ))
        dao.clearActiveOp()
        jobId
    }

    fun getCompileJob(jobId: String): WritableMap = runBlocking {
        val row = dao.compileJob(jobId) ?: return@runBlocking Arguments.createMap()
        val map = JsonBridge.toWritableMap(row.payload)
        if (row.draftId != null) map.putString("draftId", row.draftId)
        map
    }

    fun persistUIState(id: String, packageName: String, screenName: String, payload: String) = runBlocking {
        dao.upsertUIState(UIStateRow(
            id = id, packageName = packageName, screenName = screenName,
            capturedAt = System.currentTimeMillis(), payload = payload,
        ))
    }

    /** Persist a complete replay run so subsequent Evidence queries succeed. */
    fun persistRun(runId: String, testId: String, testVersion: Int, passed: Boolean, payload: String) = runBlocking {
        dao.upsertRun(ReplayRunRow(runId, testId, testVersion, passed, payload, System.currentTimeMillis()))
    }

    private fun accessibilityEnabled(): Boolean {
        val am = ctx.getSystemService(android.content.Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabled = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        val id = "${ctx.packageName}/.capture.PocketQaAccessibilityService"
        return enabled.any { it.id.endsWith(id) || it.id.contains("PocketQaAccessibilityService") }
    }

    private fun demoShopInstalled(): Boolean = try {
        ctx.packageManager.getApplicationInfo("com.techphantoms.pocketqa.demoshop", 0)
        true
    } catch (_: Throwable) {
        false
    }

    private fun ReadableMap.optString(key: String): String =
        if (hasKey(key)) getString(key) ?: "" else ""

    private fun mergeJson(base: String, patch: JsonObject): String {
        val el = JsonBridge.json.parseToJsonElement(base).jsonObject
        return JsonObject(el + patch).toString()
    }

    /**
     * djb2 hash — matches src/domain/ids.ts so the same testHash is emitted by
     * either side of the bridge.
     */
    private fun djb2(input: String): String {
        var hash = 5381L
        for (c in input) hash = (hash * 33 + c.code) and 0xFFFFFFFFL
        return hash.toString(16)
    }
}
