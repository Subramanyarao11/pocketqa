package com.techphantoms.pocketqa.explorer

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.techphantoms.pocketqa.inference.InferenceRouter
import com.techphantoms.pocketqa.policy.PolicyEngine
import com.techphantoms.pocketqa.storage.PocketQaRepository

/**
 * ExplorerAgent — bounded exploration; proposal-only (PRD §11.8).
 *
 * Only the same ReplayExecutor performs actions.  The agent:
 *   1. Observes the current UIState.
 *   2. Filters visible/enabled/non-sensitive candidate nodes via PolicyEngine.
 *   3. Ranks candidates (heuristic first; on-device AI ranking optional).
 *   4. Calls executor.performTap for at most `Mission.maxActions` actions.
 *   5. Stops on new state / budget / hard stop / user stop.
 *   6. Emits a proposal — never mutates the approved library.
 */
class ExplorerAgent(
    private val ctx: ReactApplicationContext,
    private val repo: PocketQaRepository,
    private val policy: PolicyEngine,
    private val inference: InferenceRouter,
) {
    fun start(missionId: String, promise: Promise) {
        promise.resolve(null)
    }
    fun stop(missionId: String) { /* cooperative cancel */ }
}
