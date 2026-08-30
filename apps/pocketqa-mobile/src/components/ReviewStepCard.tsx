import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react-native";
import {
  iconSize,
  layout,
  spacing,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
} from "@theme";
import { Card } from "./Card";
import { Chip } from "./Chip";
import { CodeChip } from "./CodeChip";
import { IconButton } from "./IconButton";
import { LinkButton } from "./LinkButton";
import { PrimaryButton } from "./Button";
import { Spacer } from "./Spacer";
import { StatusPill } from "./StatusPill";
import { TextField } from "./TextField";
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
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const [assertTarget, setAssertTarget] = useState("");
  const [assertKind, setAssertKind] = useState<AssertionKind>("textVisible");
  const warn = step.needsHumanCorrection || !step.selector;
  const confidence = step.selector?.primary.confidence ?? 0;
  const confidenceTone = confidence >= 0.85 ? "lime" : confidence >= 0.6 ? "cyan" : "amber";
  const provenance = provenanceForStep(step, compiledBy);

  return (
    <Card tone={warn ? "warn" : "surface"}>
      <TouchableOpacity
        onPress={() => setExpanded((x) => !x)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Step ${index + 1}: ${step.label}`}
      >
        <View style={styles.headline}>
          <View style={layout.fill}>
            <Text style={typography.metadata}>{`Step ${index + 1}`}</Text>
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
          {expanded
            ? <ChevronDown color={colors.textDim} size={iconSize.md} />
            : <ChevronRight color={colors.textDim} size={iconSize.md} />}
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.detail}>
          {/* CAP-08. "View candidates" used to live inside the `step.selector`
              block, so it was hidden in exactly the case that needs it: a step
              with no resolved target. On a Compose capture that is every step,
              which left the review screen with a "Needs correction" badge and no
              way to act on it. */}
          {!step.selector && (
            <View style={styles.rowBetween}>
              <Text style={typography.eyebrow}>No selector resolved</Text>
              {onOpenSelectors && (
                <LinkButton label="Choose target" onPress={onOpenSelectors} accessibilityLabel="Choose a selector" />
              )}
            </View>
          )}
          {step.attribution?.method === "inferred" && (
            <Text style={typography.bodyMuted}>
              {`Inferred from the screen change · ${(step.attribution.confidence * 100).toFixed(0)}%`}
              {step.attribution.signals?.length ? ` · ${step.attribution.signals.join("; ")}` : ""}
            </Text>
          )}
          {step.selector && (
            <>
              <View style={styles.rowBetween}>
                <Text style={typography.eyebrow}>Primary selector</Text>
                {onOpenSelectors && (
                  <LinkButton label="View candidates" onPress={onOpenSelectors} accessibilityLabel="View selector candidates" />
                )}
              </View>
              <CodeChip>{`${step.selector.primary.strategy} = ${step.selector.primary.value}`}</CodeChip>
              <Text style={typography.bodyMuted}>{step.selector.primary.reason}</Text>
              {step.selector.fallbacks.length > 0 && (
                <>
                  <Text style={[typography.eyebrow, styles.sectionGap]}>Fallbacks</Text>
                  {step.selector.fallbacks.map((f, i) => (
                    <CodeChip key={i}>
                      {`${f.strategy} = ${f.value} · ${(f.confidence * 100).toFixed(0)}%`}
                    </CodeChip>
                  ))}
                </>
              )}
            </>
          )}

          {(step.action === "typeText" || step.action === "clearText") && onEditInput && (
            <>
              <Text style={typography.eyebrow}>Input value</Text>
              <TextField
                value={step.input ?? ""}
                onChangeText={onEditInput}
                placeholder="Text to type"
                accessibilityLabel="Step input value"
                style={styles.field}
              />
            </>
          )}

          {step.action === "wait" && onEditWait && (
            <>
              <Text style={typography.eyebrow}>Wait (ms)</Text>
              <TextField
                value={String(step.waitMs ?? 300)}
                onChangeText={(v) => onEditWait(Math.max(0, Number(v.replace(/[^0-9]/g, "")) || 0))}
                keyboardType="number-pad"
                accessibilityLabel="Wait milliseconds"
                style={styles.field}
              />
            </>
          )}

          {step.assertions.length > 0 && (
            <>
              <Text style={typography.eyebrow}>Step assertions</Text>
              {step.assertions.map((a) => (
                <View key={a.id} style={styles.assertionRow}>
                  <View style={layout.fill}>
                    <Text style={typography.bodyMuted}>• {a.kind} — “{a.target}”</Text>
                    <Text style={typography.metadata}>{a.reason}</Text>
                  </View>
                  {onRemoveAssertion && (
                    <LinkButton
                      label="Remove"
                      tone="red"
                      onPress={() => onRemoveAssertion(a.id)}
                      accessibilityLabel="Remove step assertion"
                    />
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
                  <Chip key={k} label={k} selected={assertKind === k} onPress={() => setAssertKind(k)} />
                ))}
              </View>
              <View style={styles.addRow}>
                <TextField
                  value={assertTarget}
                  onChangeText={setAssertTarget}
                  placeholder="Target text or ID"
                  accessibilityLabel="Assertion target"
                  style={layout.fill}
                />
                <PrimaryButton
                  label="Add"
                  onPress={() => {
                    if (assertTarget.trim()) {
                      onAddAssertion(assertKind, assertTarget.trim());
                      setAssertTarget("");
                    }
                  }}
                  disabled={!assertTarget.trim()}
                  accessibilityLabel="Add assertion"
                />
              </View>
            </View>
          )}

          <View style={styles.controls}>
            {onMove && (
              <>
                <IconButton
                  icon={<ArrowUp color={colors.text} size={iconSize.md} />}
                  onPress={() => onMove(-1)}
                  accessibilityLabel="Move step up"
                />
                <IconButton
                  icon={<ArrowDown color={colors.text} size={iconSize.md} />}
                  onPress={() => onMove(1)}
                  accessibilityLabel="Move step down"
                />
              </>
            )}
            <Spacer />
            {onDelete && (
              <LinkButton label="Delete" tone="red" onPress={onDelete} accessibilityLabel="Delete step" />
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

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  headline: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  pillRow: { ...layout.rowWrap, marginTop: spacing.sm },
  detail: { marginTop: spacing.md, gap: spacing.xs },
  rowBetween: { ...layout.rowBetween, gap: spacing.sm },
  sectionGap: { marginTop: spacing.sm },
  field: { marginVertical: spacing.xs },
  assertionRow: { ...layout.row, gap: spacing.sm },
  addAssertion: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  kindRow: layout.rowWrap,
  addRow: { ...layout.row, gap: spacing.sm },
  controls: { ...layout.row, gap: spacing.sm, marginTop: spacing.sm },
}));
