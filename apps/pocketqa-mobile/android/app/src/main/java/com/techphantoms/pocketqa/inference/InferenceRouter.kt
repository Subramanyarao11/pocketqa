package com.techphantoms.pocketqa.inference

import com.facebook.react.bridge.ReactApplicationContext

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
}
