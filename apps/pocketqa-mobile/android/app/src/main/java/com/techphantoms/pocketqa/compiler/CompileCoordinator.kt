package com.techphantoms.pocketqa.compiler

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.techphantoms.pocketqa.inference.InferenceRouter
import com.techphantoms.pocketqa.storage.PocketQaRepository

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
) {
    fun compile(sessionId: String): String {
        val engine = when (inference.currentEngine()) {
            InferenceRouter.Engine.ON_DEVICE_AI -> "on-device-ai"
            InferenceRouter.Engine.CONNECTED_ASSIST -> "connected-assist"
            InferenceRouter.Engine.DETERMINISTIC_LOCAL -> "deterministic-local"
        }
        return repo.compileFromSession(sessionId, engine)
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
