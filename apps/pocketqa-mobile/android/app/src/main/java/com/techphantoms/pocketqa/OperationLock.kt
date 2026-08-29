package com.techphantoms.pocketqa

import java.util.concurrent.atomic.AtomicReference

/**
 * Process-wide single-writer lock over the "active operation" (§10.2).
 *
 * PocketQA never allows more than one capture / replay / mission to be running
 * at the same time — competing accessibility handlers would race for the tree
 * and Room row updates could interleave. The lock is acquired at the bridge
 * boundary in [PocketQaModule.guard]-flavoured helpers; failure returns a
 * recoverable [ConflictingOperationException] so the JS layer can surface the
 * conflict with the standard error envelope.
 */
object OperationLock {

    enum class Kind { CAPTURE, REPLAY, MISSION }

    data class Holder(val kind: Kind, val id: String, val since: Long)

    private val active = AtomicReference<Holder?>(null)

    class ConflictingOperationException(val current: Holder, val requested: Kind, val requestedId: String) :
        IllegalStateException(
            "Cannot start $requested($requestedId) — ${current.kind}(${current.id}) is still active."
        )

    /** Acquire the lock or throw [ConflictingOperationException]. */
    fun acquire(kind: Kind, id: String) {
        val holder = Holder(kind, id, System.currentTimeMillis())
        val previous = active.compareAndExchange(null, holder)
        if (previous != null) throw ConflictingOperationException(previous, kind, id)
    }

    /** Release only when the current holder matches — safe against double release. */
    fun release(kind: Kind, id: String) {
        val current = active.get() ?: return
        if (current.kind == kind && current.id == id) active.set(null)
    }

    fun current(): Holder? = active.get()

    /** Called on foreground rehydrate: if Room says nothing is active, clear. */
    fun clear() { active.set(null) }
}
