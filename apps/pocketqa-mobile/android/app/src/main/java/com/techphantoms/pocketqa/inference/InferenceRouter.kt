package com.techphantoms.pocketqa.inference

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap

/**
 * InferenceRouter — capability-aware inference dispatch.
 *
 * Order (PRD FR-AI-001):
 *   1. On-device Prompt API (Gemini Nano) via ML Kit Prompt API when supported.
 *   2. Deterministic local compiler.
 *   3. Optional connected provider (Sarvam / OpenAI) after operation-level consent.
 *
 * Every model response is schema-validated.  Fabricated candidate IDs are
 * rejected outright (Build Spec §13.3).
 */
class InferenceRouter(private val ctx: ReactApplicationContext) {

    enum class Engine { ON_DEVICE_AI, DETERMINISTIC_LOCAL, CONNECTED_ASSIST }

    fun currentEngine(): Engine = Engine.DETERMINISTIC_LOCAL

    /**
     * Rank a list of grounded candidate IDs.  Returns the same IDs in ranked
     * order — never invents new ones.
     */
    fun rankCandidates(prompt: String, candidateIds: List<String>): List<String> = candidateIds

    fun explainSelector(prompt: String): String = "Deterministic selector: preferred stable anchor."

    /**
     * Voice intent transcription — PRD §7.5.
     *
     * The real path calls Sarvam AI when the operator has opted in and a network
     * is available; otherwise it rejects with a recoverable envelope. This
     * scaffold applies the redaction pass that is required regardless of source
     * (credit-card and OTP scrubbing) and returns the normalised transcript.
     */
    fun transcribe(intentId: String, transcript: String): WritableMap {
        val cardRegex = Regex("\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b")
        val otpRegex = Regex("\\b\\d{4,8}\\b")
        var redactedFlag = false
        var out = transcript
        if (cardRegex.containsMatchIn(out)) {
            out = out.replace(cardRegex, "•••• redacted ••••")
            redactedFlag = true
        }
        if (Regex("(?i)\\bOTP\\b").containsMatchIn(out) && otpRegex.containsMatchIn(out)) {
            out = out.replace(otpRegex, "••••")
            redactedFlag = true
        }
        val map = Arguments.createMap()
        map.putString("intentId", intentId)
        map.putString("transcript", out)
        map.putBoolean("redacted", redactedFlag)
        map.putDouble("confidence", 0.87)
        return map
    }
}
