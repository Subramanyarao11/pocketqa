import { StyleSheet, Text, View } from "react-native";
import { spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import { StatusPill } from "./StatusPill";
import { GhostButton } from "./Button";

export interface ReadinessRowProps {
  label: string;
  status: "ready" | "needs-action" | "optional-unavailable" | "unsupported";
  detail: string;
  action?: { label: string; onPress: () => void };
}

const map = {
  ready:                { tone: "lime" as const,  copy: "Ready" },
  "needs-action":       { tone: "amber" as const, copy: "Needs action" },
  "optional-unavailable": { tone: "dim" as const, copy: "Optional unavailable" },
  unsupported:          { tone: "red" as const,   copy: "Unsupported" },
};

export function ReadinessRow({ label, status, detail, action }: ReadinessRowProps) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const { tone, copy } = map[status];
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${label}, ${copy}. ${detail}`}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.headline}>
          <Text style={typography.h2}>{label}</Text>
          <StatusPill label={copy} tone={tone} />
        </View>
        <Text style={typography.bodyMuted}>{detail}</Text>
      </View>
      {action && <GhostButton label={action.label} onPress={action.onPress} />}
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
  headline: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 2 },
});
