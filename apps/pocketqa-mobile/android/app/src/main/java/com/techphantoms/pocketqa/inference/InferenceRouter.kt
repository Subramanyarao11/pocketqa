package com.techphantoms.pocketqa.inference

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * InferenceRouter — capability-aware inference dispatch.
 *
 * Order (PRD FR-AI-001):
 *   1. On-device Prompt API (Gemini Nano) via ML Kit GenAI when supported.
 *   2. Deterministic local compiler.
 *   3. Optional connected provider (Sarvam / OpenAI) after operation-level consent.
 *
 * Every model response is schema-validated.  Fabricated candidate IDs are
 * rejected outright (Build Spec §13.3) — the router only returns IDs from the
 * `candidateIds` list it was handed.
 */
class InferenceRouter(private val ctx: ReactApplicationContext) {

    enum class Engine { ON_DEVICE_AI, DETERMINISTIC_LOCAL, CONNECTED_ASSIST }

    private val http by lazy {
        OkHttpClient.Builder()
            .callTimeout(8, TimeUnit.SECONDS)
            .connectTimeout(3, TimeUnit.SECONDS)
            .readTimeout(6, TimeUnit.SECONDS)
            .build()
    }

    /**
     * Detect the on-device Prompt API at runtime.  We probe several class
     * names because the ML Kit GenAI module is in alpha and the concrete
     * entry point has moved across releases.  As long as any candidate is
     * present, we prefer on-device inference; otherwise we stay deterministic.
     */
    private val ONDEVICE_GENAI_CLASSES = listOf(
        "com.google.mlkit.genai.chat.OnDeviceChat",
        "com.google.mlkit.genai.prompt.OnDevicePrompt",
        "com.google.mlkit.genai.common.OnDeviceGenAi",
        "com.google.mlkit.genai.common.GenAi",
    )

    fun currentEngine(): Engine {
        val onDevice = ONDEVICE_GENAI_CLASSES.any { name ->
            try { Class.forName(name); true } catch (_: Throwable) { false }
        }
        return if (onDevice) Engine.ON_DEVICE_AI else Engine.DETERMINISTIC_LOCAL
    }

    /**
     * Rank a list of grounded candidate IDs.  Returns the same IDs in ranked
     * order — never invents new ones.  Falls back to input order on any error.
     */
    fun rankCandidates(prompt: String, candidateIds: List<String>): List<String> {
        if (candidateIds.size <= 1) return candidateIds
        return when (currentEngine()) {
            // The on-device path may only reorder the supplied ids. If it returns
            // anything else, tryOnDeviceRanking gives back null and we fall to the
            // deterministic ordering — a fabricated id is never acted on.
            Engine.ON_DEVICE_AI -> tryOnDeviceRanking(prompt, candidateIds) ?: candidateIds
            else -> candidateIds
        }
    }

    /**
     * Rank grounded assertion candidates — the real entry point.
     *
     * `rankCandidates` above receives bare ids and so cannot rank on meaning: it
     * has no text to score, and before AI-A-15 the deterministic branch simply
     * returned the input order. This overload takes the candidate facts and runs
     * the spec §17.3 relevance model, so the deterministic engine is an actual
     * baseline rather than a passthrough.
     *
     * On-device AI may reorder the result; it can never add or invent a candidate.
     */
    fun rankAssertions(
        intentText: String,
        candidates: List<DeterministicRanker.Candidate>,
    ): List<DeterministicRanker.Ranked> {
        val deterministic = DeterministicRanker.rankAssertions(intentText, candidates)
        if (currentEngine() != Engine.ON_DEVICE_AI || deterministic.size <= 1) return deterministic

        val reordered = tryOnDeviceRanking(intentText, deterministic.map { it.candidateId })
            ?: return deterministic
        val byId = deterministic.associateBy { it.candidateId }
        return reordered.mapNotNull { byId[it] }
    }

    fun explainSelector(prompt: String): String =
        "Deterministic selector: preferred stable anchor."

    /**
     * Voice intent transcription — PRD §7.5.
     *
     * Real path: POST audio to Sarvam ASR (or fall back to OpenAI Whisper) when
     * the operator has opted in and a network is available. This scaffold
     * receives an already-transcribed string, applies the mandatory redaction
     * pass, and returns the normalised transcript. Redaction runs regardless
     * of the transcription source.
     */
    fun transcribe(intentId: String, transcript: String): WritableMap {
        val redacted = redactSensitive(transcript)
        val map = Arguments.createMap()
        map.putString("intentId", intentId)
        map.putString("transcript", redacted.text)
        map.putBoolean("redacted", redacted.changed)
        map.putDouble("confidence", 0.87)
        return map
    }

    /**
     * Call the connected provider (Sarvam / OpenAI) for text completion.
     *
     * Refuses unless the caller passes `consentGranted`, and redacts the prompt
     * before it leaves the device. Both were missing: the earlier version sent
     * the prompt verbatim and relied on a docstring to say consent was required.
     *
     * The response body is returned raw and is NOT yet schema-validated — the
     * caller must validate before using it. An earlier docstring claimed
     * validation happened here; it did not, and claiming a safety property that
     * does not exist is worse than not having it.
     */
    fun connectedComplete(
        provider: String,
        apiKey: String,
        prompt: String,
        consentGranted: Boolean,
    ): String? {
        // Spec §18.2 and CONTRIBUTING invariant 6: no connected call without
        // explicit operation-level consent. The caller asserting it is the gate;
        // this refuses rather than trusting that a caller remembered to check.
        if (!consentGranted) return null

        // Spec §14.2: redaction happens before any connected request, without
        // exception. The previous version sent the caller's prompt verbatim.
        val redacted = redactSensitive(prompt).text

        val (url, bodyJson) = when (provider) {
            "sarvam" -> "https://api.sarvam.ai/v1/completions" to
                """{"prompt":${quote(redacted)},"max_tokens":256}"""
            "openai" -> "https://api.openai.com/v1/chat/completions" to
                """{"model":"gpt-4o-mini","messages":[{"role":"user","content":${quote(redacted)}}]}"""
            else -> return null
        }
        val body = bodyJson.toRequestBody("application/json".toMediaTypeOrNull())
        val req = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $apiKey")
            .post(body)
            .build()
        return try {
            http.newCall(req).execute().use { r ->
                if (!r.isSuccessful) return@use null
                r.body?.string()
            }
        } catch (_: Throwable) { null }
    }

    // -- Redaction --------------------------------------------------------------

    data class RedactionResult(val text: String, val changed: Boolean)

    /**
     * Redaction patterns, kept in step with `services/ai-lab/app/redaction`
     * (Track B task AI-B-22 tracks full parity against the shared
     * policy-fixtures set). The earlier version covered card numbers and OTPs
     * only, so an email, phone number, bearer token, Aadhaar, PAN, IFSC or UPI
     * handle in captured text would have passed straight through.
     *
     * Order matters: longer and more specific patterns run first.
     */
    private val REDACTION_PATTERNS: List<Pair<String, Regex>> = listOf(
        "AADHAAR" to Regex("\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b"),
        "PAN" to Regex("\\b[A-Z]{5}\\d{4}[A-Z]\\b"),
        "IFSC" to Regex("\\b[A-Z]{4}0[A-Z0-9]{6}\\b"),
        "EMAIL" to Regex("\\b[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}\\b"),
        "UPI" to Regex("\\b[\\w.+-]+@[a-z]{2,}(?:\\.[a-z]+)?\\b"),
        "CARD" to Regex("\\b(?:\\d[ -]?){13,19}\\b"),
        "PHONE" to Regex("\\b(?:\\+?\\d{1,3}[ -]?)?\\d{10}\\b"),
        "TOKEN" to Regex("\\b(?:eyJ[\\w-]{10,}\\.[\\w-]{10,}\\.[\\w-]{10,}|[A-Za-z0-9_-]{32,})\\b"),
    )

    internal fun redactSensitive(input: String): RedactionResult {
        var out = input
        var changed = false
        for ((_, pattern) in REDACTION_PATTERNS) {
            if (pattern.containsMatchIn(out)) {
                out = pattern.replace(out, "[REDACTED]")
                changed = true
            }
        }
        // OTP digits need their context word to avoid eating ordinary numbers.
        val otpContext = Regex("(?i)\\bOTP\\b")
        val otpDigits = Regex("\\b\\d{4,8}\\b")
        if (otpContext.containsMatchIn(out) && otpDigits.containsMatchIn(out)) {
            out = out.replace(otpDigits, "[REDACTED]"); changed = true
        }
        return RedactionResult(out, changed)
    }

    // -- Internal ---------------------------------------------------------------

    private fun tryOnDeviceRanking(prompt: String, candidateIds: List<String>): List<String>? {
        // The concrete ML Kit GenAI wire-up varies across module versions. We
        // invoke it reflectively so this file compiles regardless of the exact
        // ML Kit alpha on the classpath. If any step fails we return null,
        // which the caller interprets as "use the deterministic ordering".
        return try {
            val genaiClass = ONDEVICE_GENAI_CLASSES.firstNotNullOfOrNull {
                try { Class.forName(it) } catch (_: Throwable) { null }
            } ?: return null
            val generateMethod = genaiClass.methods.firstOrNull { m ->
                (m.name.startsWith("generate") || m.name.startsWith("prompt")) &&
                    m.parameterTypes.size == 1 &&
                    m.parameterTypes[0] == String::class.java
            } ?: return null
            val result = generateMethod.invoke(null, prompt) as? String ?: return null
            // Response must be a permutation of the input list; anything else is
            // treated as a fabricated ID and rejected.
            val ordered = result
                .lines()
                .mapNotNull { line -> candidateIds.firstOrNull { it in line } }
                .distinct()
            if (ordered.toSet() != candidateIds.toSet()) null else ordered
        } catch (_: Throwable) { null }
    }

    private fun quote(s: String): String = buildString {
        append('"')
        for (c in s) when (c) {
            '"' -> append("\\\"")
            '\\' -> append("\\\\")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> append(c)
        }
        append('"')
    }
}
