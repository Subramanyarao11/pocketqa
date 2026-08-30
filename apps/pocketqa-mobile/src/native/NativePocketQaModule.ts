import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

/**
 * TurboModule spec — consumed by React Native's codegen at build time.
 *
 * Codegen types are intentionally simple: primitives, `Object`, and
 * `Array<Object>` are used for the complex domain payloads.  The strictly
 * typed shapes live in `types.ts` and are the source of truth for the rest
 * of the app — the spec here only tells codegen how to marshal values
 * across the JSI/TurboModule boundary.
 *
 * Anything defined here becomes a generated `NativePocketQaModuleSpec`
 * abstract class in Kotlin (Android) and Objective-C++ (iOS).  The concrete
 * module implementation extends that class instead of ReactContextBaseJavaModule.
 */
export interface Spec extends TurboModule {
  // ---- startup / readiness ----
  getStartupState(): Promise<Object>;
  getReadiness(): Promise<Object>;
  openAccessibilitySettings(): Promise<void>;
  listAllowlistedApps(): Promise<Array<Object>>;
  setOfflineMode(offline: boolean): Promise<void>;

  // ---- consent + intent ----
  recordConsent(): Promise<void>;
  createIntent(input: Object): Promise<Object>;

  // ---- capture ----
  startCapture(input: Object): Promise<Object>;
  simulateCaptureEvent(sessionId: string, evt: Object): Promise<void>;
  pauseCapture(sessionId: string): Promise<void>;
  resumeCapture(sessionId: string): Promise<void>;
  finishCapture(sessionId: string): Promise<Object>;
  cancelCapture(sessionId: string, deleteArtifacts: boolean): Promise<void>;

  // ---- compile / drafts ----
  getCompileJob(jobId: string): Promise<Object>;
  cancelAiEnhancement(jobId: string): Promise<void>;
  getDraft(draftId: string): Promise<Object>;
  saveDraft(req: Object): Promise<Object>;
  validateDraft(draftId: string): Promise<Object>;
  approveDraft(draftId: string): Promise<Object>;

  // ---- tests + runs ----
  listTests(): Promise<Array<Object>>;
  getTest(testId: string, version: number): Promise<Object>;
  startReplay(testId: string, version: number): Promise<Object>;
  stopReplay(runId: string): Promise<void>;
  getRun(runId: string): Promise<Object>;
  getEvidenceTimeline(runId: string): Promise<Array<Object>>;
  getState(stateId: string): Promise<Object>;
  listSelectorCandidates(draftId: string, stepId: string): Promise<Array<Object>>;
  promoteFallbackSelector(draftId: string, stepId: string, candidateIndex: number): Promise<Object>;
  applyAiSelectorRepair(runId: string, stepId: string): Promise<Object>;
  getFailureProposal(runId: string): Promise<Object>;
  submitVoiceTranscript(intentId: string, transcript: string): Promise<Object>;
  checkpointActiveOperation(): Promise<void>;

  // ---- missions ----
  createMission(input: Object): Promise<Object>;
  approveAndStartMission(missionId: string): Promise<void>;
  stopMission(missionId: string): Promise<void>;
  getMission(missionId: string): Promise<Object>;

  // ---- exports ----
  exportTest(testId: string, version: number): Promise<Object>;
  exportEvidence(runId: string): Promise<Object>;
  shareArtifact(uri: string, mimeType: string): Promise<void>;
  copyRedactedDiagnostics(runId: string): Promise<void>;

  // ---- providers + teardown ----
  saveProviderCredential(input: Object): Promise<Object>;
  deleteProviderCredential(provider: string): Promise<void>;
  saveAiLabEndpoint(url: string): Promise<Object>;
  deleteAiLabEndpoint(): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  deleteTest(testId: string): Promise<void>;
  deleteAllData(): Promise<void>;

  // ---- event emitter contract (required by NativeEventEmitter) ----
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>("PocketQaModule");
