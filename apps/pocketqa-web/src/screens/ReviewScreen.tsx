import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { TestStep } from "../lib/schemas";

export function ReviewScreen() {
  const { state, actions } = useStore();
  const draft = state.draft;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const validationIssues = useMemo(() => {
    if (!draft) return ["Draft not compiled."];
    const errs: string[] = [];
    for (const step of draft.steps) {
      if (step.needsHumanCorrection) errs.push(`Step ${step.order + 1} needs review — action is unknown.`);
      if (!step.selector && ["tap", "longPress", "typeText"].includes(step.action)) {
        errs.push(`Step ${step.order + 1} has no selector.`);
      }
    }
    if (draft.finalAssertions.length === 0) errs.push("At least one end-state assertion is required.");
    return errs;
  }, [draft]);

  if (!draft) {
    return (
      <div>
        <div className="screen-header">
          <button className="back-btn" onClick={() => actions.navigate("home")}>← Back</button>
          <span className="screen-title">Review</span>
        </div>
        <div className="card danger">
          <div style={{ fontWeight: 600 }}>Compilation failed</div>
          <div className="p-dim" style={{ marginTop: 6 }}>
            The compiler could not produce a schema-valid draft. This typically means the session had no captured events or the state library was incomplete.
          </div>
          <button className="btn block" style={{ marginTop: 10 }} onClick={() => actions.navigate("capture")}>Return to capture</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="screen-header">
        <button className="back-btn" onClick={() => actions.navigate("capture")}>← Back</button>
        <span className="screen-title">Review draft</span>
      </div>

      <div className="card">
        <input
          className="input"
          value={draft.name}
          onChange={(e) => actions.updateDraft({ name: e.target.value })}
        />
        <div className="p-dim" style={{ marginTop: 6 }}>{draft.intent}</div>
        <div className="row" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
          <span className="pill cyan">Compiled by <strong style={{ marginLeft: 4 }}>{draft.compiledBy}</strong></span>
          <span className="pill dim">{draft.steps.length} steps</span>
          <span className="pill dim">{draft.finalAssertions.length} final assertions</span>
          {draft.offlineOnly && <span className="pill lime">Offline compile</span>}
        </div>
      </div>

      <div className="eyebrow">Steps</div>
      {draft.steps.map((step, i) => (
        <StepCard
          key={step.id}
          step={step}
          index={i}
          expanded={expandedId === step.id}
          onToggle={() => setExpandedId(expandedId === step.id ? null : step.id)}
          onDelete={() => actions.updateDraft({
            steps: draft.steps.filter((s) => s.id !== step.id).map((s, idx) => ({ ...s, order: idx })),
          })}
          onMove={(dir) => {
            const idx = draft.steps.findIndex((s) => s.id === step.id);
            const target = idx + dir;
            if (target < 0 || target >= draft.steps.length) return;
            const next = draft.steps.slice();
            [next[idx], next[target]] = [next[target], next[idx]];
            actions.updateDraft({ steps: next.map((s, o) => ({ ...s, order: o })) });
          }}
        />
      ))}

      <div className="eyebrow">Final assertions</div>
      {draft.finalAssertions.length === 0 && (
        <div className="card warn">
          <div style={{ fontWeight: 600 }}>Add an end-state assertion</div>
          <div className="p-dim" style={{ marginTop: 4 }}>
            PocketQA requires at least one assertion in the last observed state.
          </div>
        </div>
      )}
      {draft.finalAssertions.map((a) => (
        <div key={a.id} className="card tight">
          <div className="row-between">
            <div>
              <div style={{ fontWeight: 600 }}>{humanAssertion(a.kind)}: “{a.target}”</div>
              <div className="p-dim" style={{ marginTop: 4 }}>{a.reason}</div>
            </div>
            <button className="btn small ghost" onClick={() => actions.updateDraft({
              finalAssertions: draft.finalAssertions.filter((x) => x.id !== a.id),
            })}>Remove</button>
          </div>
        </div>
      ))}

      {validationIssues.length > 0 && (
        <div className="card warn">
          <div style={{ fontWeight: 600 }}>Blocking issues — FR-REV-002</div>
          <ul className="list-clean" style={{ marginTop: 4 }}>
            {validationIssues.map((v) => (
              <li key={v} className="p-dim">• {v}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn danger" onClick={() => {
          if (confirm("Discard this draft?")) actions.discardDraft();
        }}>Discard</button>
        <span className="spacer" />
        <button
          className="btn primary"
          disabled={validationIssues.length > 0}
          onClick={() => actions.approveDraft()}
        >
          Approve & continue →
        </button>
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  expanded,
  onToggle,
  onDelete,
  onMove,
}: {
  step: TestStep;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const warn = step.needsHumanCorrection || !step.selector;
  return (
    <div className={`step ${warn ? "warn" : ""}`}>
      <div className="step-num">{index + 1}</div>
      <div className="row-between" onClick={onToggle} style={{ cursor: "pointer" }}>
        <div>
          <div className="title">{step.label}</div>
          <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <span className="pill dim">{step.action}</span>
            {step.selector && (
              <span className={`pill ${step.selector.primary.confidence >= 0.85 ? "lime" : step.selector.primary.confidence >= 0.6 ? "cyan" : "amber"}`}>
                {step.selector.primary.strategy} · {(step.selector.primary.confidence * 100).toFixed(0)}%
              </span>
            )}
            {step.assertions.length > 0 && <span className="pill violet">{step.assertions.length} assertion{step.assertions.length === 1 ? "" : "s"}</span>}
          </div>
        </div>
        <span className="pill dim">{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 10 }}>
          {step.selector ? (
            <>
              <div className="p-dim" style={{ fontSize: 12 }}>Primary selector</div>
              <div className="selector">{step.selector.primary.strategy} = {step.selector.primary.value}</div>
              <div className="p-dim" style={{ marginTop: 4 }}>{step.selector.primary.reason}</div>
              {step.selector.fallbacks.length > 0 && (
                <>
                  <div className="p-dim" style={{ fontSize: 12, marginTop: 8 }}>Fallbacks</div>
                  {step.selector.fallbacks.map((f, i) => (
                    <div key={i} className="selector" style={{ marginTop: 2 }}>
                      {f.strategy} = {f.value} · {(f.confidence * 100).toFixed(0)}%
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <div className="p-dim">No selector needed for this action.</div>
          )}
          {step.assertions.length > 0 && (
            <>
              <div className="p-dim" style={{ fontSize: 12, marginTop: 10 }}>Step assertions</div>
              {step.assertions.map((a) => (
                <div key={a.id} className="p-dim" style={{ fontSize: 12 }}>
                  • {humanAssertion(a.kind)} “{a.target}” <span style={{ opacity: 0.7 }}>({a.reason})</span>
                </div>
              ))}
            </>
          )}
          <div className="row" style={{ gap: 6, marginTop: 12 }}>
            <button className="btn small ghost" onClick={() => onMove(-1)}>↑</button>
            <button className="btn small ghost" onClick={() => onMove(1)}>↓</button>
            <span className="spacer" />
            <button className="btn small danger" onClick={onDelete}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function humanAssertion(kind: string): string {
  switch (kind) {
    case "textVisible": return "Text visible";
    case "textAbsent": return "Text absent";
    case "elementEnabled": return "Element enabled";
    case "elementDisabled": return "Element disabled";
    case "onScreen": return "On screen";
    case "elementCount": return "Element count";
    default: return kind;
  }
}
