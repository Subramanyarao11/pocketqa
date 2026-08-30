package com.techphantoms.pocketqa.inference

/**
 * Per-operation consent scope, enforced at the TaskClient boundary.
 *
 * The wire protocol lets the server accept work at four levels of consent
 * (see services/ai-lab app/engines/base.py ConsentState). On the device we
 * only ever grant per-operation, never per-app or per-session — approving a
 * failure explanation does not approve sending capture data next time.
 *
 * The token is created by whichever coordinator is about to call an AI task
 * and is consumed by TaskClient.run. Handing a token to a task other than
 * the one it was granted for throws — this is deliberately loud because it
 * indicates a broken consent surface, not a runtime error.
 */
sealed class ConsentToken(val serverState: String) {

    /**
     * The operator has agreed that this specific task may leave the device
     * for this specific run. Any drift (task id, direction, operation id)
     * invalidates the token.
     */
    class GrantedForOperation(
        val taskId: String,
        val operationId: String,
        val grantedAt: Long = System.currentTimeMillis(),
    ) : ConsentToken(serverState = "OPERATION_LEVEL_GRANTED")

    /**
     * The server has told us this task carries no privacy risk (e.g. rank
     * with no free-text). Included so the wire representation is complete;
     * not currently produced by the device.
     */
    object NotRequired : ConsentToken(serverState = "NOT_REQUIRED")

    /**
     * Explicitly denied — the caller should not attempt the network call.
     */
    object Denied : ConsentToken(serverState = "DENIED")

    /**
     * Fail loudly when a token is handed to a task it was not granted for.
     *
     * Scope only — whether the network may be used at all is
     * [isNetworkPermitted]. Denied used to fail here too, which made a refusal
     * throw out of TaskClient.run instead of returning the deterministic
     * result its own contract promises ("a failure is a Result with value ==
     * null, never an exception"), and left the Denied branch further down that
     * function unreachable. A refusal is an ordinary outcome; only a mismatched
     * token is a broken consent surface.
     */
    fun assertMatches(taskId: String) {
        val ok = when (this) {
            is GrantedForOperation -> this.taskId == taskId
            NotRequired, Denied -> true
        }
        require(ok) { "ConsentToken does not authorise task \"$taskId\"" }
    }

    fun isNetworkPermitted(): Boolean = this !is Denied
}
