import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing, typography } from "@theme";
import { Card } from "./Card";
import { StatusPill } from "./StatusPill";
import type { AssertionKind, CompilerEngine, TestStep } from "@domain";

const ASSERTION_KINDS: AssertionKind[] = ["textVisible", "textAbsent", "elementEnabled", "elementDisabled", "onScreen"];

export interface ReviewStepCardProps {
  step: TestStep;
  index: number;
  compiledBy?: CompilerEngine;
  onDelete?: () => void;
  onMove?: (dir: -1 | 1) => void;
  onEditInput?: (value: string) => void;
  onEditWait?: (ms: number) => void;
  onOpenSelectors?: () => void;
  onAddAssertion?: (kind: AssertionKind, target: string) => void;
  onRemoveAssertion?: (assertionId: string) => void;
}

/** Collapsed/expanded step preview per §7.9, with provenance + editable input/wait. */
export function ReviewStepCard({
  step, index, compiledBy,
  onDelete, onMove, onEditInput, onEditWait, onOpenSelectors, onAddAssertion, onRemoveAssertion,
}: ReviewStepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [assertTarget, setAssertTarget] = useState("");
  const [assertKind, setAssertKind] = useState<AssertionKind>("textVisible");
  const warn = step.needsHumanCorrection || !step.selector;
  const confidence = step.selector?.primary.confidence ?? 0;
  const confidenceTone = confidence >= 0.85 ? "lime" : confidence >= 0.6 ? "cyan" : "amber";
  const provenance = provenanceForStep(step, compiledBy);

  return (
    <Card tone={warn ? "warn" : "surface"} style={{ borderLeftWidth: warn ? 3 : 1, borderLeftColor: warn ? colors.amber : colors.border }}>
      <TouchableOpacity onPress={() => setExpanded((x) => !x)} accessibilityRole="button" accessibilityLabel={`Step ${index + 1}: ${step.label}`}>
        <View style={styles.headline}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.metadata]}>{`Step ${index + 1}`}</Text>
            <Text style={typography.body} numberOfLines={2}>{step.label}</Text>
            <View style={styles.pillRow}>
              <StatusPill label={step.action} tone="dim" />
              <StatusPill label={provenance.label} tone={provenance.tone} />
              {step.selector && (
                <StatusPill
                  label={`${step.selector.primary.strategy} · ${(confidence * 100).toFixed(0)}%`}
                  tone={confidenceTone}
                />
              )}
              {step.assertions.length > 0 && (
                <StatusPill label={`${step.assertions.length} assertion${step.assertions.length === 1 ? "" : "s"}`} tone="violet" />
              )}
              {step.needsHumanCorrection && <StatusPill label="Needs correction" tone="amber" />}
            </View>
          </View>
          <Text style={typography.metadata}>{expanded ? "▾" : "▸"}</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.detail}>
          {step.selector && (
            <>
              <View style={styles.rowBetween}>
                <Text style={typography.eyebrow}>Primary selector</Text>
                {onOpenSelectors && (
                  <TouchableOpacity onPress={onOpenSelectors} accessibilityLabel="View selector candidates">
                    <Text style={styles.link}>View candidates</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.selector}>{step.selector.primary.strategy} = {step.selector.primary.value}</Text>
              <Text style={typography.bodyMuted}>{step.selector.primary.reason}</Text>
              {step.selector.fallbacks.length > 0 && (
                <>
                  <Text style={[typography.eyebrow, { marginTop: spacing.sm }]}>Fallbacks</Text>
                  {step.selector.fallbacks.map((f, i) => (
                    <Text key={i} style={styles.selector}>
                      {f.strategy} = {f.value} · {(f.confidence * 100).toFixed(0)}%
                    </Text>
                  ))}
                </>
              )}
            </>
          )}

          {(step.action === "typeText" || step.action === "clearText") && onEditInput && (
            <>
              <Text style={typography.eyebrow}>Input value</Text>
              <TextInput
                style={styles.input}
                value={step.input ?? ""}
                onChangeText={onEditInput}
                placeholder="Text to type"
                placeholderTextColor={colors.textDim}
                accessibilityLabel="Step input value"
              />
            </>
          )}

          {step.action === "wait" && onEditWait && (
            <>
              <Text style={typography.eyebrow}>Wait (ms)</Text>
              <TextInput
                style={styles.input}
                value={String(step.waitMs ?? 300)}
                onChangeText={(v) => onEditWait(Math.max(0, Number(v.replace(/[^0-9]/g, "")) || 0))}
                keyboardType="number-pad"
                accessibilityLabel="Wait milliseconds"
              />
            </>
          )}

          {step.assertions.length > 0 && (
            <>
              <Text style={typography.eyebrow}>Step assertions</Text>
              {step.assertions.map((a) => (
                <View key={a.id} style={styles.assertionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.bodyMuted}>• {a.kind} — “{a.target}”</Text>
                    <Text style={typography.metadata}>{a.reason}</Text>
                  </View>
                  {onRemoveAssertion && (
                    <TouchableOpacity onPress={() => onRemoveAssertion(a.id)} accessibilityLabel="Remove step assertion">
                      <Text style={{ color: colors.red }}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </>
          )}

          {onAddAssertion && (
            <View style={styles.addAssertion}>
              <Text style={typography.eyebrow}>Add step assertion</Text>
              <View style={styles.kindRow}>
                {ASSERTION_KINDS.map((k) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setAssertKind(k)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: assertKind === k }}
                    style={[styles.kindChip, assertKind === k && styles.kindChipActive]}
                  >
                    <Text style={{ color: assertKind === k ? "#0A0F14" : colors.text, fontSize: 12 }}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={assertTarget}
                  onChangeText={setAssertTarget}
                  placeholder="Target text or ID"
                  placeholderTextColor={colors.textDim}
                  accessibilityLabel="Assertion target"
                />
                <TouchableOpacity
                  onPress={() => {
                    if (assertTarget.trim()) {
                      onAddAssertion(assertKind, assertTarget.trim());
                      setAssertTarget("");
                    }
                  }}
                  accessibilityLabel="Add assertion"
                  style={styles.addBtn}
                >
                  <Text style={{ color: "#0A0F14", fontWeight: "700" }}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.controls}>
            {onMove && (
              <>
                <TouchableOpacity onPress={() => onMove(-1)} style={styles.controlBtn} accessibilityLabel="Move step up"><Text style={{ color: colors.text }}>↑</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onMove(1)} style={styles.controlBtn} accessibilityLabel="Move step down"><Text style={{ color: colors.text }}>↓</Text></TouchableOpacity>
              </>
            )}
            <View style={{ flex: 1 }} />
            {onDelete && (
              <TouchableOpacity onPress={onDelete} accessibilityLabel="Delete step"><Text style={{ color: colors.red, fontWeight: "600" }}>Delete</Text></TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </Card>
  );
}

function provenanceForStep(
  step: TestStep,
  compiledBy?: CompilerEngine
): { label: string; tone: "lime" | "violet" | "cyan" | "amber" | "dim" } {
  if (step.needsHumanCorrection) return { label: "Needs your input", tone: "amber" };
  if (!compiledBy) return { label: "Generated locally", tone: "lime" };
  switch (compiledBy) {
    case "deterministic-local": return { label: "Generated locally", tone: "lime" };
    case "on-device-ai": return { label: "Proposed by on-device AI", tone: "violet" };
    case "connected-assist": return { label: "Connected assist", tone: "cyan" };
    default: return { label: "Generated locally", tone: "lime" };
  }
}

const styles = StyleSheet.create({
  headline: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  detail: { marginTop: spacing.md, gap: spacing.xs },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { color: colors.cyan, fontWeight: "600" },
  selector: {
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.cyan,
    backgroundColor: "rgba(89,217,255,0.06)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  input: {
    color: colors.text,
    borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.input,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  assertionRow: {
    flexDirection: "row", alignItems: "center",
    gap: spacing.sm, paddingVertical: 4,
  },
  addAssertion: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  kindChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  kindChipActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  addBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
  },
  controls: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" },
  controlBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
});
