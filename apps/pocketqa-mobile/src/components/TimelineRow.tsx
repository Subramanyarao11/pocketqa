import { StyleSheet, Text, View } from "react-native";
import { spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import { StatusPill } from "./StatusPill";
import type { StepResult, TestStep } from "@domain";

/** Replay step + result row (§7.11 timeline). */
export function TimelineRow({ step, index, result }: { step: TestStep; index: number; result?: StepResult }) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const tone = result?.status === "pass" ? "lime" : result?.status === "fail" ? "red" : "dim";
  return (
    <View style={styles.row}>
      <View style={styles.tick}>
        <Text style={typography.metadata}>{String(index + 1).padStart(2, "0")}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={typography.body} numberOfLines={2}>{step.label}</Text>
        <Text style={typography.metadata}>
          {step.selector ? `${step.selector.primary.strategy}=${step.selector.primary.value}` : step.action}
          {result?.elapsedMs !== undefined ? ` · ${result.elapsedMs}ms` : ""}
        </Text>
        {result?.reason && (
          <Text style={[typography.bodyMuted, { color: colors.red, marginTop: 4 }]}>
            {result.errorCode ? `[${result.errorCode}] ` : ""}{result.reason}
          </Text>
        )}
      </View>
      <StatusPill label={result ? result.status.toUpperCase() : "—"} tone={tone} />
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tick: {
    width: 34, height: 34, borderRadius: 9,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
});
