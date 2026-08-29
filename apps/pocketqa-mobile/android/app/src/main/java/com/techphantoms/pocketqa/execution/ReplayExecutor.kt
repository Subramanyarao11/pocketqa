package com.techphantoms.pocketqa.execution

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.techphantoms.pocketqa.policy.PolicyEngine
import com.techphantoms.pocketqa.storage.PocketQaRepository

/**
 * ReplayExecutor — the only component allowed to dispatch UI actions.
 *
 * Contract (mirrors `src/domain/executor.ts`):
 *   * Loads only an approved, immutable ApprovedTest by (id, version).
 *   * For each step: verify active package → observe current state →
 *     resolve exactly one target → policy classify → deterministic action →
 *     wait for idle → evaluate assertions → persist evidence.
 *   * On ambiguity or blocked category: hard stop; no coordinate fallback.
 *   * Never asks an inference model what to do next.
 */
class ReplayExecutor(
    private val ctx: ReactApplicationContext,
    private val repo: PocketQaRepository,
    private val policy: PolicyEngine,
) {
    fun start(testId: String, version: Int, promise: Promise) {
        // Insert a Run row, kick a coroutine that emits REPLAY_PROGRESS,
        // and REPLAY_FINISHED on terminal state.
        promise.resolve(mapOf("runId" to "run_stub"))
    }

    fun stop(runId: String) { /* cooperative cancel */ }
}
