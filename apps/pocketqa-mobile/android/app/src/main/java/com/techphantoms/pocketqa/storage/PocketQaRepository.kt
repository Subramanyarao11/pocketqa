package com.techphantoms.pocketqa.storage

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap

/**
 * PocketQaRepository — Room + app-private evidence files.
 *
 * All persistence lives here.  React Native never receives raw
 * AccessibilityNodeInfo, unredacted screenshots, or provider keys.
 *
 * v0 methods are stubbed; each returns a schema-shaped WritableMap so the
 * bridge can be exercised end-to-end while the Room DAO lands.
 */
class PocketQaRepository(private val ctx: ReactApplicationContext) {

    data class Session(val id: String, val packageName: String)

    fun startupState(): WritableMap {
        val map = Arguments.createMap()
        map.putBoolean("onboardingComplete", false)
        map.putMap("readiness", readiness())
        return map
    }

    fun readiness(): WritableMap {
        val map = Arguments.createMap()
        map.putBoolean("consented", false)
        map.putBoolean("accessibilityEnabled", false)
        map.putBoolean("screenshotSupported", true)
        map.putBoolean("storageOk", true)
        map.putBoolean("microphoneReady", false)
        map.putBoolean("demoShopInstalled", true)
        map.putString("onDeviceModel", "unavailable")
        map.putBoolean("offlineMode", true)
        val connected = Arguments.createMap()
        val sarvam = Arguments.createMap(); sarvam.putBoolean("configured", false)
        val openai = Arguments.createMap(); openai.putBoolean("configured", false)
        connected.putMap("sarvam", sarvam)
        connected.putMap("openai", openai)
        map.putMap("connected", connected)
        val allowlist = Arguments.createArray()
        allowlist.pushString("com.techphantoms.pocketqa.demoshop")
        map.putArray("packageAllowlist", allowlist)
        return map
    }

    fun setOfflineMode(offline: Boolean) { /* persist to Room */ }
    fun recordConsent() { /* insert consent row with version + UTC timestamp */ }
    fun createIntent(input: ReadableMap): WritableMap {
        val out = Arguments.createMap(); out.putString("intentId", "intent_stub"); return out
    }

    fun startSession(intentId: String, fixture: String?): Session {
        // Real impl inserts a Session row and returns identifier + package.
        return Session(id = "sess_stub", packageName = "com.techphantoms.pocketqa.demoshop")
    }
    fun appendSimulatedEvent(sessionId: String, evt: ReadableMap) { /* insert CaptureEvent */ }
    fun pauseSession(id: String) {}
    fun resumeSession(id: String) {}
    fun cancelSession(id: String, deleteArtifacts: Boolean) {}

    fun draft(id: String): WritableMap = Arguments.createMap()
    fun saveDraft(req: ReadableMap): WritableMap = Arguments.createMap()
    fun approveDraft(id: String): WritableMap = Arguments.createMap()
    fun listTests(): com.facebook.react.bridge.WritableArray = Arguments.createArray()
    fun getTest(id: String, version: Int?): WritableMap = Arguments.createMap()
    fun run(id: String): WritableMap = Arguments.createMap()
    fun evidenceTimeline(id: String): com.facebook.react.bridge.WritableArray = Arguments.createArray()
    fun createMission(input: ReadableMap): WritableMap = Arguments.createMap()
    fun mission(id: String): WritableMap = Arguments.createMap()
    fun saveProvider(input: ReadableMap): WritableMap = Arguments.createMap()
    fun deleteProvider(provider: String) {}
    fun deleteSession(id: String) {}
    fun deleteTest(id: String) {}
    fun deleteAll() {}

    // §7.11 evidence detail + §7.9 selector candidates ---------------------------------------
    fun uiState(stateId: String): WritableMap? = null // Room-backed impl fills nodes + ocr.
    fun selectorCandidates(draftId: String, stepId: String): com.facebook.react.bridge.WritableArray =
        Arguments.createArray()
    fun promoteFallback(draftId: String, stepId: String, candidateIndex: Int): WritableMap =
        Arguments.createMap()
    fun failureProposal(runId: String): WritableMap? = null

    /**
     * §10 session persistence — invoked when the app is backgrounded.
     * The Room row for the active operation gets its `checkpointedAt` bumped so
     * that reopening the app can rehydrate the workflow at the exact step.
     */
    fun checkpoint() { /* update SessionState.checkpointedAt = now, flush WAL */ }
}
