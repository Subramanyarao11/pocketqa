import {
  ALLOWLISTED_PACKAGES,
  buildEvidencePayload,
  compileDraft,
  djb2,
  nextId,
  proposeFailureRepair,
  rankSelectorsForNode,
  replayApprovedTest,
  runMission,
  DemoShop,
  type ApprovedTest,
  type CaptureEvent,
  type Mission,
  type MissionEvent,
  type TestDraft,
  type UIState,
  toMaestroYaml,
} from "@domain";
import type {
  CompileJob,
  DeviceReadiness,
  EvidenceStep,
  FailureProposal,
  IntentInput,
  MissionDraft,
  MissionSummary,
  PocketQaEvent,
  PocketQaNativeApi,
  ProviderCredentialInput,
  ProviderStatus,
  ReplayRunSummary,
  SaveDraftRequest,
  SelectorCandidate,
  ShareableArtifact,
  StartupState,
  TargetApp,
  TestListItem,
  ValidationResult,
  VoiceTranscript,
} from "./types";

/**
 * Deterministic mock of the native façade.  It exercises the same domain
 * modules the Kotlin side will call, so features can build/test against a
 * realistic contract before native code exists.
 */
export function createMockPocketQaNative(): PocketQaNativeApi {
  type ListenerFn = (e: PocketQaEvent) => void;
  const listeners = new Set<ListenerFn>();
  const emit = (e: PocketQaEvent) => listeners.forEach((l) => l(e));

  const readiness: DeviceReadiness = {
    consented: false,
    accessibilityEnabled: false,
    screenshotSupported: true,
    storageOk: true,
    microphoneReady: false,
    demoShopInstalled: true,
    onDeviceModel: "unavailable",
    connected: { sarvam: { configured: false }, openai: { configured: false } },
    aiLab: { configured: false },
    offlineMode: true,
    packageAllowlist: [...ALLOWLISTED_PACKAGES],
  };

  interface Session {
    id: string;
    intentId: string;
    intent: string;
    packageName: string;
    shop: DemoShop.ShopState;
    events: CaptureEvent[];
    states: Record<string, UIState>;
    paused: boolean;
    startedAt: number;
  }
  const sessions = new Map<string, Session>();
  const drafts = new Map<string, TestDraft>();
  const tests = new Map<string, ApprovedTest>();
  const runs = new Map<string, ReplayRunSummary>();
  const missions = new Map<string, { mission: Mission; events: MissionEvent[]; summary?: MissionSummary }>();
  const intents = new Map<string, IntentInput & { intentId: string }>();
  /** Merged state library — capture sessions + replay-observed states. */
  const capturedStates = new Map<string, UIState>();
  /** In-memory export payloads keyed by "path"; the real bridge writes to disk. */
  const exportBlobs = new Map<string, string>();

  return {
    async getStartupState(): Promise<StartupState> {
      return { onboardingComplete: readiness.consented && readiness.accessibilityEnabled, readiness };
    },
    async getReadiness() { return readiness; },
    async openAccessibilitySettings() {
      // Mock — flip service on to reflect a returning user.
      readiness.accessibilityEnabled = true;
      emit({ type: "SERVICE_STATUS_CHANGED", payload: "enabled" });
    },
    async listAllowlistedApps(): Promise<TargetApp[]> {
      return ALLOWLISTED_PACKAGES.map((p) => ({
        packageName: p,
        displayName: "PocketQA Demo Shop",
        fixtureIds: ["reset", "coupon-retry", "selector-drift"],
      }));
    },
    async setOfflineMode(offline: boolean) { readiness.offlineMode = offline; },

    async recordConsent() { readiness.consented = true; },

    async createIntent(input: IntentInput) {
      const intentId = nextId("intent");
      intents.set(intentId, { ...input, intentId });
      return { intentId };
    },

    async startCapture({ intentId, fixture }) {
      const intent = intents.get(intentId);
      if (!intent) throw new Error("intent not found");
      const sessionId = nextId("sess");
      const shop = DemoShop.reduceShop(DemoShop.INITIAL_SHOP_STATE, { type: "reset", fixture: (fixture ?? "coupon-retry") as never });
      const session: Session = {
        id: sessionId,
        intentId,
        intent: intent.intent,
        packageName: intent.packageName,
        shop,
        events: [],
        states: {},
        paused: false,
        startedAt: Date.now(),
      };
      sessions.set(sessionId, session);
      emit({
        type: "CAPTURE_PROGRESS",
        payload: {
          sessionId, state: "recording", stepCount: 0, elapsedMs: 0,
          packageName: session.packageName,
        },
      });
      return { sessionId };
    },

    async simulateCaptureEvent(sessionId, evt) {
      const s = sessions.get(sessionId);
      if (!s || s.paused) return;
      // Hard-stop categories the mock recognises without touching the shop.
      const hardStop = classifyLabelHardStop(evt.label, s.packageName, readiness.packageAllowlist);
      if (hardStop) {
        emit({
          type: "CAPTURE_HARD_STOP",
          payload: { operationId: sessionId, ...hardStop },
        });
        return;
      }
      const before = DemoShop.snapshotShop(s.shop);
      // Map high-level label -> shop action.
      const nextShop = mapLabelToShopAction(s.shop, evt.label, evt.input);
      s.shop = nextShop;
      const after = DemoShop.snapshotShop(nextShop);
      s.states[before.id] = before;
      s.states[after.id] = after;
      capturedStates.set(before.id, before);
      capturedStates.set(after.id, after);
      s.events.push({
        id: nextId("evt"),
        at: Date.now(),
        action: evt.action,
        nodeId: findNodeIdForLabel(before, evt.label),
        input: evt.input,
        beforeStateId: before.id,
        afterStateId: after.id,
      });
      emit({
        type: "CAPTURE_PROGRESS",
        payload: {
          sessionId, state: "recording", stepCount: s.events.length,
          elapsedMs: Date.now() - s.startedAt,
          lastActionLabel: evt.label,
          packageName: s.packageName,
        },
      });
    },

    async pauseCapture(sessionId) {
      const s = sessions.get(sessionId); if (!s) return;
      s.paused = true;
      emit({ type: "CAPTURE_PROGRESS", payload: { sessionId, state: "paused", stepCount: s.events.length, elapsedMs: Date.now() - s.startedAt, packageName: s.packageName } });
    },
    async resumeCapture(sessionId) {
      const s = sessions.get(sessionId); if (!s) return;
      s.paused = false;
      emit({ type: "CAPTURE_PROGRESS", payload: { sessionId, state: "recording", stepCount: s.events.length, elapsedMs: Date.now() - s.startedAt, packageName: s.packageName } });
    },

    async finishCapture(sessionId) {
      const s = sessions.get(sessionId); if (!s) throw new Error("session not found");
      const jobId = nextId("compile");
      const stages: CompileJob["stages"] = [
        { id: "finalising", label: "Finalizing evidence", state: "done" },
        { id: "redacting", label: "Redacting sensitive content", state: "done" },
        { id: "selectors", label: "Building selectors", state: "active" },
        { id: "assertions", label: "Deriving assertions", state: "pending" },
        { id: "enhance", label: "Enhancing locally when supported", state: "pending" },
        { id: "validating", label: "Validating draft", state: "pending" },
      ];
      emit({ type: "COMPILE_PROGRESS", payload: { jobId, engine: "deterministic-local", stages, finished: false } });

      const result = compileDraft({
        intent: s.intent,
        packageName: s.packageName,
        states: s.states,
        events: s.events,
        engine: readiness.onDeviceModel === "ready" ? "on-device-ai" : "deterministic-local",
      });
      if (result.ok) {
        drafts.set(result.draft.id, result.draft);
        emit({
          type: "COMPILE_PROGRESS",
          payload: {
            jobId, engine: result.engine,
            stages: stages.map((st) => ({ ...st, state: "done" })),
            finished: true, draftId: result.draft.id,
          },
        });
        emit({ type: "COMPILE_FINISHED", payload: { jobId, draftId: result.draft.id } });
      } else {
        emit({
          type: "COMPILE_PROGRESS",
          payload: {
            jobId, engine: "deterministic-local",
            stages: stages.map((st) => ({ ...st, state: "failed" })),
            finished: true,
            error: { code: "COMPILE_FAILED", message: result.reason, recoverable: true, correlationId: jobId },
          },
        });
      }
      return { compileJobId: jobId };
    },

    async cancelCapture(sessionId, _delete) { sessions.delete(sessionId); },

    async getCompileJob(jobId) {
      // The mock delivers everything via events; a caller that polls gets a
      // trivial finished shell.  Real Kotlin backs this with a Room row.
      return { jobId, engine: "deterministic-local", stages: [], finished: true };
    },
    async cancelAiEnhancement(_jobId) { /* no-op */ },

    async getDraft(draftId) {
      const d = drafts.get(draftId); if (!d) throw new Error("draft not found");
      return d;
    },
    async saveDraft(req: SaveDraftRequest) {
      const d = drafts.get(req.draftId); if (!d) throw new Error("draft not found");
      const next: TestDraft = { ...d, ...req.patch };
      drafts.set(next.id, next);
      return next;
    },
    async validateDraft(draftId): Promise<ValidationResult> {
      const d = drafts.get(draftId); if (!d) return { valid: false, errors: ["draft not found"], warnings: [] };
      const errors: string[] = [];
      const warnings: string[] = [];
      for (const step of d.steps) {
        if (step.needsHumanCorrection) errors.push(`Step ${step.order + 1} needs human correction.`);
        if (!step.selector && ["tap", "longPress", "typeText"].includes(step.action)) {
          errors.push(`Step ${step.order + 1} has no selector.`);
        }
      }
      if (d.finalAssertions.length === 0) errors.push("At least one end-state assertion is required.");
      return { valid: errors.length === 0, errors, warnings };
    },
    async approveDraft(draftId) {
      const d = drafts.get(draftId); if (!d) throw new Error("draft not found");
      const approved: ApprovedTest = {
        ...d,
        schemaVersion: "pocketqa/approved-test@1",
        version: 1,
        approvedAt: Date.now(),
        schemaHash: djb2(JSON.stringify(d)),
      };
      tests.set(approved.id, approved);
      drafts.delete(d.id);
      return approved;
    },

    async listTests(): Promise<TestListItem[]> {
      return [...tests.values()].map((t) => {
        const lastRun = [...runs.values()].filter((r) => r.test.id === t.id).pop();
        return {
          id: t.id,
          version: t.version,
          name: t.name,
          packageName: t.packageName,
          compiledBy: t.compiledBy,
          lastRunPassed: lastRun?.result.passed,
        };
      });
    },
    async getTest(testId) {
      const t = tests.get(testId); if (!t) throw new Error("test not found");
      return t;
    },

    async startReplay(testId, _version) {
      const t = tests.get(testId); if (!t) throw new Error("test not found");
      const runId = nextId("run");
      // Fresh shop starting state for the demo harness.
      let shop = DemoShop.reduceShop(DemoShop.INITIAL_SHOP_STATE, { type: "reset", fixture: "coupon-retry" });
      const harness = {
        activePackageName: () => shop.packageName,
        currentState: () => DemoShop.snapshotShop(shop),
        async performTap(nodeId: string) {
          shop = applyTap(shop, nodeId);
        },
        async performTypeText(nodeId: string, value: string) {
          if (nodeId === "coupon-input") shop = DemoShop.reduceShop(shop, { type: "typeCoupon", value });
        },
        async performBack() {
          if (shop.screen === "detail") shop = DemoShop.reduceShop(shop, { type: "backToList" });
        },
        async performLaunch(_pkg: string) { /* no-op */ },
        async waitForIdle(_ms: number) { /* no-op */ },
        async resetFixture() {
          shop = DemoShop.reduceShop(DemoShop.INITIAL_SHOP_STATE, { type: "reset", fixture: "coupon-retry" });
        },
      };
      const runningEmit = { stopped: false };
      const total = t.steps.length;
      const result = await replayApprovedTest(t, harness, {
        stopSignal: runningEmit,
        offline: readiness.offlineMode,
        onStep: (idx, msg, level) => {
          if (idx < 0) return;
          emit({
            type: "REPLAY_PROGRESS",
            payload: {
              runId, stepIndex: idx, totalSteps: total,
              currentLabel: msg, elapsedMs: 0,
              latestAssertion: level === "pass" ? { pass: true, label: msg } : level === "fail" ? { pass: false, label: msg } : undefined,
            },
          });
        },
      });
      const summary: ReplayRunSummary = { runId, test: t, result };
      runs.set(runId, summary);
      emit({ type: "REPLAY_FINISHED", payload: summary });
      return { runId };
    },

    async stopReplay(_runId) { /* no-op — cooperative stop already exposed by harness signal */ },

    async getRun(runId) {
      const r = runs.get(runId); if (!r) throw new Error("run not found");
      return r;
    },
    async getEvidenceTimeline(runId): Promise<EvidenceStep[]> {
      const r = runs.get(runId); if (!r) return [];
      return r.test.steps.map((step) => {
        const stepResult = r.result.stepResults.find((sr) => sr.stepId === step.id);
        const beforeState = capturedStates.get(step.beforeStateId);
        const afterState = capturedStates.get(step.afterStateId);
        return { step, result: stepResult, beforeState, afterState };
      });
    },

    async getState(stateId) {
      return capturedStates.get(stateId) ?? null;
    },

    async listSelectorCandidates(draftId, stepId): Promise<SelectorCandidate[]> {
      const d = drafts.get(draftId); if (!d) return [];
      const step = d.steps.find((s) => s.id === stepId);
      if (!step) return [];
      const beforeState = capturedStates.get(step.beforeStateId);
      const source = step.selector;
      if (!source) return [];

      // Prefer the ranked list computed against the observed node when we have it.
      const node = beforeState?.nodes.find((n) =>
        n.testId === source.primary.value ||
        n.resourceId === source.primary.value ||
        n.text === source.primary.value ||
        n.contentDescription === source.primary.value
      );
      const ranked = node && beforeState ? rankSelectorsForNode(beforeState, node) : source;
      const all = [ranked.primary, ...ranked.fallbacks];
      return all.map((sel, i) => ({
        index: i,
        strategy: sel.strategy,
        value: sel.value,
        confidence: sel.confidence,
        reason: sel.reason,
        role: sel.role,
        isPrimary: i === 0,
      }));
    },

    async applyAiSelectorRepair(runId, _stepId) {
      const r = runs.get(runId);
      if (!r) throw new Error("run not found");
      const t = tests.get(r.test.id);
      if (!t) throw new Error("test not found");
      const bumped: ApprovedTest = { ...t, version: t.version + 1, approvedAt: Date.now() };
      tests.set(t.id, bumped);
      return bumped;
    },

    async promoteFallbackSelector(draftId, stepId, candidateIndex) {
      const d = drafts.get(draftId); if (!d) throw new Error("draft not found");
      const stepIdx = d.steps.findIndex((s) => s.id === stepId);
      if (stepIdx < 0) throw new Error("step not found");
      const step = d.steps[stepIdx];
      if (!step.selector) return d;
      const options = [step.selector.primary, ...step.selector.fallbacks];
      const chosen = options[candidateIndex];
      if (!chosen) throw new Error("candidate not found");
      const remaining = options.filter((_, i) => i !== candidateIndex);
      const nextSelector = {
        primary: chosen,
        fallbacks: remaining.slice(0, 2).filter((s) => s.strategy !== "coordinates"),
        candidateCount: step.selector.candidateCount,
      };
      const next: TestDraft = {
        ...d,
        steps: d.steps.map((s, i) => i === stepIdx
          ? { ...s, selector: nextSelector, needsHumanCorrection: false }
          : s),
      };
      drafts.set(next.id, next);
      return next;
    },

    async getFailureProposal(runId): Promise<FailureProposal | null> {
      const r = runs.get(runId); if (!r) return null;
      const p = proposeFailureRepair(r.test, r.result);
      return p as FailureProposal | null;
    },

    async submitVoiceTranscript(intentId, transcript): Promise<VoiceTranscript> {
      const stored = intents.get(intentId);
      if (stored) intents.set(intentId, { ...stored, intent: transcript });
      // Very light redaction pass — strip anything that looks like a card / OTP.
      const redacted = transcript.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "•••• redacted ••••");
      return {
        intentId,
        transcript: redacted,
        redacted: redacted !== transcript,
        confidence: 0.87,
      };
    },

    async checkpointActiveOperation() {
      // Mock: no-op — the real Kotlin coordinator persists the active op to Room.
    },

    async createMission(input: MissionDraft): Promise<Mission> {
      const mission: Mission = {
        id: nextId("mission"),
        goal: input.goal,
        packageAllowlist: input.packageAllowlist,
        maxActions: input.maxActions,
        maxDurationSeconds: input.maxDurationSeconds,
        allowedTools: ["observe", "tapNode", "back", "waitForIdle", "stop"],
        hardStops: [
          "Payment / purchase controls",
          "Account or permissions",
          "Cross-package navigation",
          "Sensitive input fields",
        ],
      };
      missions.set(mission.id, { mission, events: [] });
      return mission;
    },

    async approveAndStartMission(missionId) {
      const entry = missions.get(missionId); if (!entry) throw new Error("mission not found");
      let shop = DemoShop.reduceShop(DemoShop.INITIAL_SHOP_STATE, { type: "reset", fixture: "coupon-retry" });
      shop = DemoShop.reduceShop(shop, { type: "addToCart", productId: "sneakers" });
      shop = DemoShop.reduceShop(shop, { type: "openCart" });
      shop = DemoShop.reduceShop(shop, { type: "typeCoupon", value: "SAVE20" });
      shop = DemoShop.reduceShop(shop, { type: "applyCoupon" });
      const harness = {
        activePackageName: () => shop.packageName,
        currentState: () => DemoShop.snapshotShop(shop),
        async performTap(nodeId: string) { shop = applyTap(shop, nodeId); },
        async performTypeText() { /* not permitted */ },
        async performBack() { /* not used */ },
        async performLaunch() { /* not used */ },
        async waitForIdle() { /* no-op */ },
        async resetFixture() { /* no-op */ },
      };
      const startedAt = Date.now();
      const stop = { stopped: false };
      const { events, proposal } = await runMission(entry.mission, harness, {
        stopSignal: stop,
        onEvent: (ev) => {
          emit({
            type: "MISSION_PROGRESS",
            payload: {
              missionId,
              actionsTaken: events.filter((e) => e.kind === "action").length,
              actionsMax: entry.mission.maxActions,
              secondsRemaining: Math.max(0, entry.mission.maxDurationSeconds - Math.floor((Date.now() - startedAt) / 1000)),
              latestEventLabel: ev.message,
            },
          });
          entry.events.push(ev);
        },
      });
      const summary: MissionSummary = {
        mission: entry.mission,
        events,
        proposal: proposal ? {
          discoveredStateId: proposal.discoveredStateId,
          candidateAssertions: proposal.candidateAssertions,
          summary: proposal.summary,
        } : undefined,
      };
      entry.summary = summary;
      emit({ type: "MISSION_FINISHED", payload: summary });
    },

    async stopMission(_missionId) { /* mock never blocks */ },

    async getMission(missionId): Promise<MissionSummary> {
      const entry = missions.get(missionId); if (!entry) throw new Error("mission not found");
      return entry.summary ?? { mission: entry.mission, events: entry.events };
    },

    async exportTest(testId, _version): Promise<ShareableArtifact> {
      const t = tests.get(testId); if (!t) throw new Error("test not found");
      // Build the deterministic YAML in memory. Real Kotlin writes to app-private
      // storage and returns a `content://` URI backed by FileProvider.
      const yaml = toMaestroYaml(t);
      exportBlobs.set(`tests/${t.id}.yaml`, yaml);
      return {
        uri: `mock://tests/${t.id}.yaml`,
        mimeType: "text/yaml",
        filename: `${t.name.replace(/\s+/g, "_")}.maestro.yaml`,
        redacted: true,
      };
    },
    async exportEvidence(runId): Promise<ShareableArtifact> {
      const r = runs.get(runId); if (!r) throw new Error("run not found");
      const states: Record<string, UIState> = {};
      for (const [id, state] of capturedStates.entries()) states[id] = state;
      const bundle = buildEvidencePayload({
        test: r.test,
        result: r.result,
        states,
        intent: r.test.intent,
        device: { model: "PocketQA Mock", os: "Android 14", app: r.test.packageName, pocketqa: "0.1.0" },
        offline: r.result.offline,
      });
      exportBlobs.set(`evidence/${r.runId}.bundle.json`, JSON.stringify(bundle, null, 2));
      return {
        uri: `mock://evidence/${r.runId}.zip`,
        mimeType: "application/zip",
        filename: `${r.test.name.replace(/\s+/g, "_")}.evidence.zip`,
        redacted: true,
      };
    },
    async shareArtifact(_uri, _mime) { /* native side calls Sharesheet */ },
    async copyRedactedDiagnostics(_runId) { /* stub */ },

    async saveProviderCredential(input: ProviderCredentialInput): Promise<ProviderStatus> {
      readiness.connected[input.provider] = {
        configured: true,
        maskedKey: `••••${input.key.slice(-4).toUpperCase()}`,
      };
      return { provider: input.provider, configured: true, maskedKey: readiness.connected[input.provider].maskedKey };
    },
    async deleteProviderCredential(provider) { readiness.connected[provider] = { configured: false }; },
    async saveAiLabEndpoint(url: string) {
      const trimmed = url.trim().replace(/\/$/, "");
      const host = trimmed.replace(/^[a-z]+:\/\//, "");
      readiness.aiLab = { configured: true, displayHost: host };
      return { configured: true, displayHost: host };
    },
    async deleteAiLabEndpoint() { readiness.aiLab = { configured: false }; },
    async deleteSession(sessionId) { sessions.delete(sessionId); },
    async deleteTest(testId) { tests.delete(testId); },
    async deleteAllData() {
      sessions.clear(); drafts.clear(); tests.clear(); runs.clear();
      missions.clear(); intents.clear(); capturedStates.clear();
    },

    addListener(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  };
}

/** Recognise hard-stop categories from an operator's typed label (§10.4). */
function classifyLabelHardStop(
  label: string,
  activePackage: string,
  allowlist: string[]
): { code: string; category: import("./types").HardStop["category"]; message: string } | null {
  const l = label.toLowerCase();
  if (!allowlist.includes(activePackage)) {
    return {
      code: "PACKAGE_BOUNDARY_VIOLATION",
      category: "package",
      message: `Active package ${activePackage} is not in the allowlist.`,
    };
  }
  if (/pay|checkout complete|confirm order|place order|purchase|buy now/.test(l)) {
    return { code: "BLOCKED_CATEGORY", category: "blocked", message: `"${label}" is in the blocked action category.` };
  }
  if (/password|otp|cvv|card number|\bpin\b|biometric/.test(l)) {
    return { code: "SENSITIVE_TARGET_BLOCKED", category: "sensitive", message: `Sensitive input target — hard stop.` };
  }
  if (/grant permission|allow permission|accept terms|delete account|sign out permanent|install|uninstall/.test(l)) {
    return { code: "BLOCKED_CATEGORY", category: "blocked", message: `Irreversible/permission action — hard stop.` };
  }
  return null;
}

function mapLabelToShopAction(shop: DemoShop.ShopState, label: string, input?: string): DemoShop.ShopState {
  const l = label.toLowerCase();
  if (/^open .* product/.test(l) || l.startsWith("tap product")) {
    return DemoShop.reduceShop(shop, { type: "openProduct", productId: "sneakers" });
  }
  if (l.includes("add") && l.includes("cart")) {
    return DemoShop.reduceShop(shop, { type: "addToCart", productId: shop.selectedProductId ?? "sneakers" });
  }
  if (l.includes("open cart") || l === "cart") {
    return DemoShop.reduceShop(shop, { type: "openCart" });
  }
  if (l.startsWith("type coupon") || l.startsWith("type ")) {
    return DemoShop.reduceShop(shop, { type: "typeCoupon", value: input ?? "SAVE20" });
  }
  if (l.includes("apply") || l.includes("use coupon")) {
    return DemoShop.reduceShop(shop, { type: "applyCoupon" });
  }
  if (l.includes("continue")) return DemoShop.reduceShop(shop, { type: "continueToCheckout" });
  if (l.includes("retry")) return DemoShop.reduceShop(shop, { type: "retryCheckout" });
  if (l.includes("checkout tick")) return DemoShop.reduceShop(shop, { type: "checkoutTick" });
  return shop;
}

function findNodeIdForLabel(state: UIState, label: string): string | undefined {
  const l = label.toLowerCase();
  const match = state.nodes.find((n) =>
    (n.text && l.includes(n.text.toLowerCase())) ||
    (n.contentDescription && l.includes(n.contentDescription.toLowerCase())) ||
    (n.testId && l.includes(n.testId.toLowerCase()))
  );
  return match?.nodeId;
}

function applyTap(shop: DemoShop.ShopState, nodeId: string): DemoShop.ShopState {
  if (nodeId.startsWith("product-card-")) {
    return DemoShop.reduceShop(shop, { type: "openProduct", productId: nodeId.replace("product-card-", "") });
  }
  if (nodeId === "add-to-cart-btn" && shop.selectedProductId) {
    return DemoShop.reduceShop(shop, { type: "addToCart", productId: shop.selectedProductId });
  }
  if (nodeId === "cart-badge") return DemoShop.reduceShop(shop, { type: "openCart" });
  if (nodeId === "back-to-list") return DemoShop.reduceShop(shop, { type: "backToList" });
  if (nodeId === "coupon-apply-btn") return DemoShop.reduceShop(shop, { type: "applyCoupon" });
  if (nodeId === "continue-checkout-btn") {
    return DemoShop.reduceShop(
      DemoShop.reduceShop(shop, { type: "continueToCheckout" }),
      { type: "checkoutTick" }
    );
  }
  if (nodeId === "retry-btn") return DemoShop.reduceShop(shop, { type: "retryCheckout" });
  if (nodeId === "coupon-details-btn") return DemoShop.reduceShop(shop, { type: "focusNode", nodeId });
  return shop;
}
