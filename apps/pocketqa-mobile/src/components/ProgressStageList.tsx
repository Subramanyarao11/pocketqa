import { Text, View } from "react-native";
import { spacing, useAppTheme, useThemeStyles, type AppTheme, type ThemeColors } from "@theme";

export interface ProgressStage {
  id: string;
  label: string;
  state: "pending" | "active" | "done" | "failed";
}

/** Determinate stage indicator for Compile Progress (§7.8). */
export function ProgressStageList({ stages }: { stages: ProgressStage[] }) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.list}>
      {stages.map((s, index) => (
        <View key={s.id} style={styles.row}>
          <View style={styles.rail}>
            <View style={[styles.dot, dotStyle(colors, s.state)]} />
            {index < stages.length - 1 && <View style={styles.connector} />}
          </View>
          <Text style={[typography.body, s.state === "pending" && { color: colors.textMuted }]}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function dotStyle(colors: ThemeColors, state: ProgressStage["state"]) {
  switch (state) {
    case "active": return { backgroundColor: colors.cyan };
    case "done":   return { backgroundColor: colors.lime };
    case "failed": return { backgroundColor: colors.red };
    case "pending":
    default:       return { backgroundColor: colors.textDim };
  }
}

const createStyles = ({ colors }: AppTheme) => ({
  list: {
    padding: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, minHeight: 44 },
  rail: { width: 16, alignItems: "center", alignSelf: "stretch" },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, zIndex: 1 },
  connector: { width: 1, flex: 1, backgroundColor: colors.border, marginVertical: 3 },
});
