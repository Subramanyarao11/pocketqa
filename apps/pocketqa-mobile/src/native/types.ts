import type {
  ApprovedTest,
  Assertion,
  CaptureEvent,
  CompilerEngine,
  Mission,
  ReplayResult,
  StepResult,
  TestDraft,
  UIState,
} from "@domain";

/** Wire-safe envelope for every native error (§11.3). */
export interface PocketQaError {
  code: string;
  message: string;
  recoverable: boolean;
  remediation?: string;
  correlationId: string;
}

export type ConnectedProvider = "sarvam" | "openai";

export interface DeviceReadiness {
  consented: boolean;
  accessibilityEnabled: boolean;
  screenshotSupported: boolean;
  storageOk: boolean;
  microphoneReady: boolean;
  demoShopInstalled: boolean;
  onDeviceModel: "unavailable" | "ready";
  connected: Record<ConnectedProvider, { configured: boolean; maskedKey?: string }>;
  aiLab: { configured: boolean; displayHost?: string };
  offlineMode: boolean;
  packageAllowlist: string[];
}

export interface TargetApp {
  packageName: string;
  displayName: string;
  fixtureIds: string[];
}

export interface StartupState {
  onboardingComplete: boolean;
  readiness: DeviceReadiness;
  activeOperation?:
    | { kind: "CAPTURE"; id: string }
    | { kind: "COMPILE"; id: string }
    | { kind: "REPLAY"; id: string }
    | { kind: "MISSION"; id: string };
}

export interface IntentInput {
  intent: string;
  packageName: string;
  fixture?: string;
  preconditions?: string;
  disclosureAcknowledged: boolean;
}

export interface StartCaptureRequest {
  intentId: string;
  fixture?: string;
}

export interface CaptureProgress {
  sessionId: string;
  state: "recording" | "paused" | "finalising" | "hard-stopped";
  stepCount: number;
  elapsedMs: number;
  lastActionLabel?: string;
  packageName: string;
  partialEvidenceWarning?: string;
}

export interface HardStop {
  operationId: string;
  code: string;
  category: "package" | "sensitive" | "blocked" | "ambiguous" | "target-missing" | "budget" | "user";
  message: string;
}

export interface CompileProgressStage {
  id: "finalising" | "redacting" | "selectors" | "assertions" | "enhance" | "validating";
  label: string;
  state: "pending" | "active" | "done" | "failed";
}

export interface CompileJob {
  jobId: string;
  engine: CompilerEngine;
  stages: CompileProgressStage[];
  finished: boolean;
  draftId?: string;
  error?: PocketQaError;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ReplayProgress {
  runId: string;
  stepIndex: number;
  totalSteps: number;
  currentLabel: string;
  elapsedMs: number;
  latestAssertion?: { pass: boolean; label: string };
}

export interface ReplayRunSummary {
  runId: string;
  test: ApprovedTest;
  result: ReplayResult;
}

export interface EvidenceStep {
  step: import("@domain").TestStep;
  result?: StepResult;
  beforeState?: UIState;
  afterState?: UIState;
}

/** §7.9 — grounded selector candidates the user can pick between. */
export interface SelectorCandidate {
  index: number;
  strategy: import("@domain").SelectorStrategy;
  value: string;
  confidence: number;
  reason: string;
  role?: string;
  isPrimary: boolean;
}

/** Wire-shape provenance emitted alongside every AI-touched surface (§5). */
export interface TaskProvenance {
  engine: string;
  model?: string;
  promptVersion?: string;
  usedModel: boolean;
  outputRejected: boolean;
  rejectionReason?: string;
  latencyMs: number;
  redacted: boolean;
  networkUsed: boolean;
  consent: string;
}

/** §7.11 — Failure Detective repair proposal, plus optional AI proposals. */
export interface FailureProposal {
  runId: string;
  stepId?: string;
  category: import("@domain").FailureCategory;
  summary: string;
  suggestion: string;
  action?:
    | { kind: "promote-fallback"; strategy: string; value: string }
    | { kind: "add-wait"; ms: number }
    | { kind: "update-fixture"; fixture: string }
    | { kind: "review-assertion"; assertionTarget: string };
  /** AI-1 explain_failure — always attributed, never replaces `suggestion`. */
  aiExplanation?: string;
  aiExplanationProvenance?: TaskProvenance;
  /** AI-4 repair_selector — surfaced beside the Apply button. */
  aiSelectorRepair?: {
    stepId: string;
    strategy: string;
    value: string;
    confidence: number;
    provenance?: TaskProvenance;
  };
  /** AI-5 classify_flake — annotates the failure; never suppresses it. */
  aiFlake?: {
    verdict: "flake" | "regression" | "inconclusive" | string;
    reason?: string;
    provenance?: TaskProvenance;
  };
}

export interface VoiceTranscript {
  intentId: string;
  transcript: string;
  redacted: boolean;
  confidence: number;
}

export interface MissionDraft {
  goal: string;
  packageAllowlist: string[];
  maxActions: number;
  maxDurationSeconds: number;
  fixture?: string;
}

export interface MissionProgress {
  missionId: string;
  actionsTaken: number;
  actionsMax: number;
  secondsRemaining: number;
  latestEventLabel?: string;
}

export interface MissionSummary {
  mission: Mission;
  events: import("@domain").MissionEvent[];
  /**
   * Which engine ranked the candidates, when one was consulted. Absent for a
   * mission that never reached the ranker — the difference matters, because the
   * review screen otherwise asserts a model was involved without showing one.
   */
  rankerProvenance?: TaskProvenance;
  proposal?: {
    discoveredStateId: string;
    candidateAssertions: Assertion[];
    summary: string;
  };
}

export interface ShareableArtifact {
  uri: string;
  mimeType: string;
  filename: string;
  redacted: boolean;
}

export interface ProviderCredentialInput {
  provider: ConnectedProvider;
  key: string;
}

export interface ProviderStatus {
  provider: ConnectedProvider;
  configured: boolean;
  maskedKey?: string;
}

export interface TestListItem {
  id: string;
  version: number;
  name: string;
  packageName: string;
  compiledBy: CompilerEngine;
  lastRunPassed?: boolean;
}

export interface SaveDraftRequest {
  draftId: string;
  baseRevision: number;
  patch: Partial<TestDraft>;
}

export type ServiceStatus = "enabled" | "disabled" | "unknown";

export type PocketQaEvent =
  | { type: "SERVICE_STATUS_CHANGED"; payload: ServiceStatus }
  | { type: "CAPTURE_PROGRESS"; payload: CaptureProgress }
  | { type: "CAPTURE_HARD_STOP"; payload: HardStop }
  | { type: "COMPILE_PROGRESS"; payload: CompileProgress }
  | { type: "COMPILE_FINISHED"; payload: { jobId: string; draftId: string } }
  | { type: "REPLAY_PROGRESS"; payload: ReplayProgress }
  | { type: "REPLAY_FINISHED"; payload: ReplayRunSummary }
  | { type: "MISSION_PROGRESS"; payload: MissionProgress }
  | { type: "MISSION_FINISHED"; payload: MissionSummary };

export type CompileProgress = CompileJob;

/** The single façade every feature imports. */
export interface PocketQaNativeApi {
  getStartupState(): Promise<StartupState>;
  getReadiness(): Promise<DeviceReadiness>;
  openAccessibilitySettings(): Promise<void>;
  listAllowlistedApps(): Promise<TargetApp[]>;
  setOfflineMode(offline: boolean): Promise<void>;

  recordConsent(): Promise<void>;

  createIntent(input: IntentInput): Promise<{ intentId: string }>;
  startCapture(input: StartCaptureRequest): Promise<{ sessionId: string }>;
  simulateCaptureEvent(sessionId: string, evt: {
    action: CaptureEvent["action"];
    label: string;
    input?: string;
  }): Promise<void>; // demo-mode helper for the mock harness
  pauseCapture(sessionId: string): Promise<void>;
  resumeCapture(sessionId: string): Promise<void>;
  finishCapture(sessionId: string): Promise<{ compileJobId: string }>;
  cancelCapture(sessionId: string, deleteArtifacts: boolean): Promise<void>;

  getCompileJob(jobId: string): Promise<CompileJob>;
  cancelAiEnhancement(jobId: string): Promise<void>;
  getDraft(draftId: string): Promise<TestDraft>;
  saveDraft(req: SaveDraftRequest): Promise<TestDraft>;
  validateDraft(draftId: string): Promise<ValidationResult>;
  approveDraft(draftId: string): Promise<ApprovedTest>;

  listTests(): Promise<TestListItem[]>;
  getTest(testId: string, version?: number): Promise<ApprovedTest>;
  startReplay(testId: string, version: number): Promise<{ runId: string }>;
  stopReplay(runId: string): Promise<void>;
  getRun(runId: string): Promise<ReplayRunSummary>;
  getEvidenceTimeline(runId: string): Promise<EvidenceStep[]>;
  getState(stateId: string): Promise<UIState | null>;
  listSelectorCandidates(draftId: string, stepId: string): Promise<SelectorCandidate[]>;
  promoteFallbackSelector(draftId: string, stepId: string, candidateIndex: number): Promise<TestDraft>;
  applyAiSelectorRepair(runId: string, stepId: string): Promise<ApprovedTest>;
  getFailureProposal(runId: string): Promise<FailureProposal | null>;
  submitVoiceTranscript(intentId: string, transcript: string): Promise<VoiceTranscript>;
  checkpointActiveOperation(): Promise<void>;

  createMission(input: MissionDraft): Promise<Mission>;
  approveAndStartMission(missionId: string): Promise<void>;
  stopMission(missionId: string): Promise<void>;
  getMission(missionId: string): Promise<MissionSummary>;

  exportTest(testId: string, version: number): Promise<ShareableArtifact>;
  exportEvidence(runId: string): Promise<ShareableArtifact>;
  shareArtifact(uri: string, mimeType: string): Promise<void>;
  copyRedactedDiagnostics(runId: string): Promise<void>;

  saveProviderCredential(input: ProviderCredentialInput): Promise<ProviderStatus>;
  deleteProviderCredential(provider: ConnectedProvider): Promise<void>;
  saveAiLabEndpoint(url: string): Promise<{ configured: boolean; displayHost: string }>;
  deleteAiLabEndpoint(): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  deleteTest(testId: string): Promise<void>;
  deleteAllData(): Promise<void>;

  addListener(cb: (event: PocketQaEvent) => void): () => void;
}
