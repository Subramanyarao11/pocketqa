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
 * Emits `COMPILE_PROGRESS` and `COMPILE_FINISHED` events via the bridge.
 */
class CompileCoordinator(
    private val repo: PocketQaRepository,
    private val inference: InferenceRouter,
) {
    fun compile(sessionId: String): String {
        // Insert compile job, run stages on a coroutine dispatcher, emit events.
        return "compile_stub"
    }

    fun job(id: String): WritableMap = Arguments.createMap()
    fun cancelAi(id: String) { /* cancel any in-flight on-device inference */ }
    fun validate(id: String): WritableMap {
        val map = Arguments.createMap()
        map.putBoolean("valid", true)
        val errors = Arguments.createArray(); val warnings = Arguments.createArray()
        map.putArray("errors", errors); map.putArray("warnings", warnings)
        return map
    }
}
