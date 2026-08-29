import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, spacing, typography } from "@theme";
import { Card } from "./Card";
import { StatusPill } from "./StatusPill";
import type { TestStep } from "@domain";

export interface ReviewStepCardProps {
  step: TestStep;
  index: number;
  onDelete?: () => void;
  onMove?: (dir: -1 | 1) => void;
}

/** Collapsed/expanded step preview per §7.9. */
export function ReviewStepCard({ step, index, onDelete, onMove }: ReviewStepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const warn = step.needsHumanCorrection || !step.selector;
  const confidence = step.selector?.primary.confidence ?? 0;
  const confidenceTone = confidence >= 0.85 ? "lime" : confidence >= 0.6 ? "cyan" : "amber";

  return (
    <Card tone={warn ? "warn" : "surface"} style={{ borderLeftWidth: warn ? 3 : 1, borderLeftColor: warn ? colors.amber : colors.border }}>
      <TouchableOpacity onPress={() => setExpanded((x) => !x)} accessibilityRole="button" accessibilityLabel={`Step ${index + 1}: ${step.label}`}>
        <View style={styles.headline}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.metadata]}>{`Step ${index + 1}`}</Text>
            <Text style={typography.body} numberOfLines={2}>{step.label}</Text>
            <View style={styles.pillRow}>
              <StatusPill label={step.action} tone="dim" />
              {step.selector && (
                <StatusPill
                  label={`${step.selector.primary.strategy} · ${(confidence * 100).toFixed(0)}%`}
                  tone={confidenceTone}
                />
              )}
              {step.assertions.length > 0 && (
                <StatusPill label={`${step.assertions.length} assertion${step.assertions.length === 1 ? "" : "s"}`} tone="violet" />
              )}
            </View>
          </View>
          <Text style={typography.metadata}>{expanded ? "▾" : "▸"}</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.detail}>
          {step.selector && (
            <>
              <Text style={typography.eyebrow}>Primary selector</Text>
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
          {step.assertions.map((a) => (
            <Text key={a.id} style={typography.bodyMuted}>
              • {a.kind} “{a.target}” — {a.reason}
            </Text>
          ))}
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

const styles = StyleSheet.create({
  headline: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  detail: { marginTop: spacing.md, gap: spacing.xs },
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
  controls: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" },
  controlBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
});
