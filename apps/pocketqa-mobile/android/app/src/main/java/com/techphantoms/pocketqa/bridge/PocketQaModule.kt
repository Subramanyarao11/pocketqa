package com.techphantoms.pocketqa.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID
import com.techphantoms.pocketqa.capture.CaptureCoordinator
import com.techphantoms.pocketqa.compiler.CompileCoordinator
import com.techphantoms.pocketqa.execution.ReplayExecutor
import com.techphantoms.pocketqa.explorer.ExplorerAgent
import com.techphantoms.pocketqa.export.ExportCoordinator
import com.techphantoms.pocketqa.inference.InferenceRouter
import com.techphantoms.pocketqa.policy.PolicyEngine
import com.techphantoms.pocketqa.storage.PocketQaRepository

/**
 * PocketQaModule — the single native bridge that satisfies the
 * PocketQaNativeApi contract declared in `src/native/types.ts`.
 *
 * Every command below is a stub in v0; each delegates to the coordinator that
 * owns the concern in Kotlin.  The bridge only serializes/deserializes and
 * enforces schema versions — business rules live in the coordinators.
 */
class PocketQaModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val repo = PocketQaRepository(reactContext)
    private val policy = PolicyEngine()
    private val inference = InferenceRouter(reactContext)
    private val capture = CaptureCoordinator(reactContext, repo, policy)
    private val compiler = CompileCoordinator(repo, inference)
    private val executor = ReplayExecutor(reactContext, repo, policy)
    private val explorer = ExplorerAgent(reactContext, repo, policy, inference)
    private val export = ExportCoordinator(reactContext, repo)

    override fun getName(): String = "PocketQaModule"

    @ReactMethod fun addListener(eventName: String) { /* required for RN EventEmitter */ }
    @ReactMethod fun removeListeners(count: Int) { /* required for RN EventEmitter */ }

    fun emit(event: String, payload: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, payload)
    }

    /**
     * Reject a promise with the wire-safe PocketQaError envelope (§11.3).
     * Every recoverable failure surfaces here so the JS layer can render
     * remediation without inventing categories.
     */
    private fun rejectWithEnvelope(
        promise: Promise,
        code: String,
        message: String,
        recoverable: Boolean = true,
        remediation: String? = null,
    ) {
        val envelope = Arguments.createMap().apply {
            putString("code", code)
            putString("message", message)
            putBoolean("recoverable", recoverable)
            if (remediation != null) putString("remediation", remediation)
            putString("correlationId", UUID.randomUUID().toString())
        }
        promise.reject(code, message, envelope)
    }

    /** Convenience wrapper so every bridge method uses the envelope on throw. */
    private inline fun guard(promise: Promise, block: () -> Unit) {
        try {
            block()
        } catch (e: com.techphantoms.pocketqa.OperationLock.ConflictingOperationException) {
            rejectWithEnvelope(
                promise,
                "OPERATION_IN_PROGRESS",
                e.message ?: "Another operation is running",
                recoverable = true,
                remediation = "Wait for the active ${e.current.kind} to finish, or cancel it first.",
            )
        } catch (e: SecurityException) {
            rejectWithEnvelope(promise, "POLICY_HARD_STOP", e.message ?: "Blocked by policy", false, e.message)
        } catch (e: IllegalStateException) {
            rejectWithEnvelope(promise, "INVALID_STATE", e.message ?: "Bad state", true, null)
        } catch (e: IllegalArgumentException) {
            rejectWithEnvelope(promise, "INVALID_INPUT", e.message ?: "Bad input", true, null)
        } catch (e: Throwable) {
            rejectWithEnvelope(promise, "UNEXPECTED", e.message ?: e::class.java.simpleName, true, null)
        }
    }

    // ---------- Startup / readiness ----------
    @ReactMethod fun getStartupState(promise: Promise) { promise.resolve(repo.startupState()) }
    @ReactMethod fun getReadiness(promise: Promise) { promise.resolve(repo.readiness()) }
    @ReactMethod fun openAccessibilitySettings(promise: Promise) {
        capture.openAccessibilitySettings(); promise.resolve(null)
    }
    @ReactMethod fun listAllowlistedApps(promise: Promise) { promise.resolve(policy.allowlist()) }
    @ReactMethod fun setOfflineMode(offline: Boolean, promise: Promise) {
        repo.setOfflineMode(offline); promise.resolve(null)
    }

    // ---------- Consent + intent ----------
    @ReactMethod fun recordConsent(promise: Promise) { repo.recordConsent(); promise.resolve(null) }
    @ReactMethod fun createIntent(input: ReadableMap, promise: Promise) {
        promise.resolve(repo.createIntent(input))
    }

    // ---------- Capture ----------
    @ReactMethod fun startCapture(input: ReadableMap, promise: Promise) {
        guard(promise) { capture.start(input, promise) }
    }
    @ReactMethod fun pauseCapture(id: String, promise: Promise) { capture.pause(id); promise.resolve(null) }
    @ReactMethod fun resumeCapture(id: String, promise: Promise) { capture.resume(id); promise.resolve(null) }
    @ReactMethod fun finishCapture(id: String, promise: Promise) { capture.finish(id, compiler, promise) }
    @ReactMethod fun cancelCapture(id: String, del: Boolean, promise: Promise) {
        capture.cancel(id, del); promise.resolve(null)
    }
    @ReactMethod fun simulateCaptureEvent(id: String, evt: ReadableMap, promise: Promise) {
        capture.simulate(id, evt); promise.resolve(null)
    }

    // ---------- Compile / draft ----------
    @ReactMethod fun getCompileJob(id: String, promise: Promise) { promise.resolve(compiler.job(id)) }
    @ReactMethod fun cancelAiEnhancement(id: String, promise: Promise) { compiler.cancelAi(id); promise.resolve(null) }
    @ReactMethod fun getDraft(id: String, promise: Promise) { promise.resolve(repo.draft(id)) }
    @ReactMethod fun saveDraft(req: ReadableMap, promise: Promise) { promise.resolve(repo.saveDraft(req)) }
    @ReactMethod fun validateDraft(id: String, promise: Promise) { promise.resolve(compiler.validate(id)) }
    @ReactMethod fun approveDraft(id: String, promise: Promise) { promise.resolve(repo.approveDraft(id)) }

    // ---------- Tests ----------
    @ReactMethod fun listTests(promise: Promise) { promise.resolve(repo.listTests()) }
    @ReactMethod fun getTest(id: String, version: Int?, promise: Promise) { promise.resolve(repo.getTest(id, version)) }
    @ReactMethod fun startReplay(id: String, version: Int, promise: Promise) {
        guard(promise) { executor.start(id, version, promise) }
    }
    @ReactMethod fun stopReplay(runId: String, promise: Promise) { executor.stop(runId); promise.resolve(null) }
    @ReactMethod fun getRun(id: String, promise: Promise) { promise.resolve(repo.run(id)) }
    @ReactMethod fun getEvidenceTimeline(id: String, promise: Promise) { promise.resolve(repo.evidenceTimeline(id)) }
    @ReactMethod fun getState(stateId: String, promise: Promise) {
        guard(promise) { promise.resolve(repo.uiState(stateId)) }
    }
    @ReactMethod fun listSelectorCandidates(draftId: String, stepId: String, promise: Promise) {
        guard(promise) { promise.resolve(repo.selectorCandidates(draftId, stepId)) }
    }
    @ReactMethod fun promoteFallbackSelector(draftId: String, stepId: String, candidateIndex: Int, promise: Promise) {
        guard(promise) { promise.resolve(repo.promoteFallback(draftId, stepId, candidateIndex)) }
    }
    @ReactMethod fun getFailureProposal(runId: String, promise: Promise) {
        guard(promise) { promise.resolve(repo.failureProposal(runId)) }
    }
    @ReactMethod fun submitVoiceTranscript(intentId: String, transcript: String, promise: Promise) {
        guard(promise) { promise.resolve(inference.transcribe(intentId, transcript)) }
    }
    @ReactMethod fun checkpointActiveOperation(promise: Promise) {
        guard(promise) { repo.checkpoint(); promise.resolve(null) }
    }

    // ---------- Missions ----------
    @ReactMethod fun createMission(input: ReadableMap, promise: Promise) { promise.resolve(repo.createMission(input)) }
    @ReactMethod fun approveAndStartMission(id: String, promise: Promise) {
        guard(promise) { explorer.start(id, promise) }
    }
    @ReactMethod fun stopMission(id: String, promise: Promise) { explorer.stop(id); promise.resolve(null) }
    @ReactMethod fun getMission(id: String, promise: Promise) { promise.resolve(repo.mission(id)) }

    // ---------- Export ----------
    @ReactMethod fun exportTest(id: String, version: Int, promise: Promise) { export.test(id, version, promise) }
    @ReactMethod fun exportEvidence(id: String, promise: Promise) { export.evidence(id, promise) }
    @ReactMethod fun shareArtifact(uri: String, mime: String, promise: Promise) { export.share(uri, mime); promise.resolve(null) }
    @ReactMethod fun copyRedactedDiagnostics(id: String, promise: Promise) { export.copyDiagnostics(id); promise.resolve(null) }

    // ---------- Providers ----------
    @ReactMethod fun saveProviderCredential(input: ReadableMap, promise: Promise) {
        promise.resolve(repo.saveProvider(input))
    }
    @ReactMethod fun deleteProviderCredential(provider: String, promise: Promise) {
        repo.deleteProvider(provider); promise.resolve(null)
    }
    @ReactMethod fun deleteSession(id: String, promise: Promise) { repo.deleteSession(id); promise.resolve(null) }
    @ReactMethod fun deleteTest(id: String, promise: Promise) { repo.deleteTest(id); promise.resolve(null) }
    @ReactMethod fun deleteAllData(promise: Promise) { repo.deleteAll(); promise.resolve(null) }
}
