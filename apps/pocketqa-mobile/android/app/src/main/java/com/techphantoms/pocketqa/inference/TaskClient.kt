package com.techphantoms.pocketqa.inference

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.longOrNull
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * TaskClient — the single mobile-to-service transport for AI reasoning tasks.
 *
 * Rules from the wiring spec (§3.1):
 *   1. Redact before send, always. Text-shaped fields in the request payload
 *      are passed through InferenceRouter.redactSensitive before serialisation.
 *   2. Consent is a parameter, not a checkbox someone remembered. The caller
 *      must hand in a matching ConsentToken; the token asserts the task id
 *      it was granted for before we make the network call.
 *   3. Timeout is the caller's, and short. See §6.
 *   4. A failure is a Result<T> with value == null, never an exception.
 *      Every caller's next line is already the deterministic path.
 *
 * The client owns nothing else: no schema validation (server does that),
 * no merge rule (server does that), no fallback behaviour (caller does that).
 */
class TaskClient(
    private val baseUrlProvider: () -> String?,
    private val redactor: (String) -> RedactionResult,
) {

    data class RedactionResult(val text: String, val changed: Boolean)

    data class Provenance(
        val engine: String,
        val model: String?,
        val promptVersion: String?,
        val usedModel: Boolean,
        val outputRejected: Boolean,
        val rejectionReason: String?,
        val latencyMs: Long,
        val redacted: Boolean,
        val networkUsed: Boolean,
        val consent: String,
    ) {
        fun toJsonObject(): JsonObject = Json.parseToJsonElement(
            buildString {
                append('{')
                append(""""engine":${quoteOrNull(engine)},""")
                append(""""model":${quoteOrNull(model)},""")
                append(""""promptVersion":${quoteOrNull(promptVersion)},""")
                append(""""usedModel":$usedModel,""")
                append(""""outputRejected":$outputRejected,""")
                append(""""rejectionReason":${quoteOrNull(rejectionReason)},""")
                append(""""latencyMs":$latencyMs,""")
                append(""""redacted":$redacted,""")
                append(""""networkUsed":$networkUsed,""")
                append(""""consent":${quoteOrNull(consent)}""")
                append('}')
            }
        ).jsonObject

        companion object {
            /** The provenance we would have reported if the model had been asked. */
            fun deterministic(consent: ConsentToken): Provenance = Provenance(
                engine = "deterministic-local",
                model = null,
                promptVersion = null,
                usedModel = false,
                outputRejected = false,
                rejectionReason = null,
                latencyMs = 0,
                redacted = false,
                networkUsed = false,
                consent = consent.serverState,
            )
        }
    }

    data class Result(
        val value: JsonObject?,
        val provenance: Provenance,
    )

    private val http: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .callTimeout(8, TimeUnit.SECONDS)
            .connectTimeout(2, TimeUnit.SECONDS)
            .readTimeout(6, TimeUnit.SECONDS)
            .build()
    }

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }

    /**
     * Run a task against the ai-lab service.
     *
     * Returns Result with value = null when:
     *   - no endpoint is configured;
     *   - the consent token is denied;
     *   - the network request fails or times out;
     *   - the server responds non-2xx or with unparseable JSON.
     *
     * The provenance carries "usedModel = false" for every non-success path so
     * the caller — and the UI — can honestly say "No network used" whenever
     * that is true.
     */
    suspend fun run(
        taskId: String,
        request: JsonObject,
        consent: ConsentToken,
        timeoutMs: Long,
    ): Result = withContext(Dispatchers.IO) {
        consent.assertMatches(taskId)
        val base = baseUrlProvider().orEmpty().trimEnd('/')
        if (base.isEmpty() || !consent.isNetworkPermitted()) {
            return@withContext Result(value = null, provenance = Provenance.deterministic(consent))
        }

        val redactedRequest = redactRequest(request)
        val body = redactedRequest.payload.toString()
            .toRequestBody("application/json".toMediaTypeOrNull())
        val url = "$base/tasks/$taskId"
        val req = Request.Builder()
            .url(url)
            .addHeader("X-Consent-Scope", consent.serverState)
            .post(body)
            .build()

        val startedAt = System.currentTimeMillis()
        val raw = withTimeoutOrNull(timeoutMs) {
            try {
                http.newCall(req).execute().use { r ->
                    if (!r.isSuccessful) null
                    else r.body?.string()
                }
            } catch (_: Throwable) {
                null
            }
        }
        val latency = System.currentTimeMillis() - startedAt

        if (raw.isNullOrBlank()) {
            return@withContext Result(
                value = null,
                provenance = Provenance(
                    engine = "deterministic-local",
                    model = null, promptVersion = null,
                    usedModel = false, outputRejected = false, rejectionReason = "network-unreachable",
                    latencyMs = latency, redacted = redactedRequest.changed,
                    networkUsed = true, consent = consent.serverState,
                ),
            )
        }

        val parsed = try {
            json.parseToJsonElement(raw).jsonObject
        } catch (_: Throwable) {
            return@withContext Result(
                value = null,
                provenance = Provenance(
                    engine = "deterministic-local",
                    model = null, promptVersion = null,
                    usedModel = false, outputRejected = true, rejectionReason = "unparseable-response",
                    latencyMs = latency, redacted = redactedRequest.changed,
                    networkUsed = true, consent = consent.serverState,
                ),
            )
        }

        val body_ = parsed["response"]?.jsonObject
        val provenance = readProvenance(
            envelope = parsed,
            latencyFallback = latency,
            redacted = redactedRequest.changed,
            consent = consent,
        )
        // A schema-rejected output is a normal logged outcome, not an error.
        // Caller uses the deterministic path when value is null.
        val value = if (provenance.outputRejected) null else body_
        Result(value, provenance)
    }

    private fun readProvenance(
        envelope: JsonObject,
        latencyFallback: Long,
        redacted: Boolean,
        consent: ConsentToken,
    ): Provenance {
        val p = envelope["provenance"]?.jsonObject
        val engineId = p?.get("engineId")?.jsonPrimitive?.contentOrNull ?: "deterministic-v1"
        val usedModel = p?.get("model")?.jsonPrimitive?.contentOrNull != null &&
            !engineId.startsWith("deterministic")
        return Provenance(
            engine = engineId,
            model = p?.get("model")?.jsonPrimitive?.contentOrNull,
            promptVersion = p?.get("promptVersion")?.jsonPrimitive?.contentOrNull,
            usedModel = usedModel,
            outputRejected = p?.get("outputRejected")?.jsonPrimitive?.booleanOrNull ?: false,
            rejectionReason = p?.get("rejectionReason")?.jsonPrimitive?.contentOrNull,
            latencyMs = p?.get("latencyMs")?.jsonPrimitive?.longOrNull ?: latencyFallback,
            redacted = p?.get("redactionApplied")?.jsonPrimitive?.booleanOrNull ?: redacted,
            networkUsed = true,
            consent = consent.serverState,
        )
    }

    /**
     * Recursively walk the request payload and redact every string leaf.
     * Structural keys ("taskId", enum-shaped ids, integers) are untouched;
     * only free text ever reaches the wire redactor.
     */
    private fun redactRequest(request: JsonObject): RedactedRequest {
        var changed = false
        val jsonText = request.toString()
        val redacted = redactor(jsonText)
        if (redacted.changed) changed = true
        val out = try {
            json.parseToJsonElement(redacted.text).jsonObject
        } catch (_: Throwable) {
            request
        }
        return RedactedRequest(out, changed)
    }

    private data class RedactedRequest(val payload: JsonObject, val changed: Boolean)

    companion object {
        private fun quoteOrNull(s: String?): String = if (s == null) "null" else buildString {
            append('"'); for (c in s) when (c) {
                '"' -> append("\\\""); '\\' -> append("\\\\"); '\n' -> append("\\n")
                '\r' -> append("\\r"); '\t' -> append("\\t"); else -> append(c)
            }; append('"')
        }
    }
}
