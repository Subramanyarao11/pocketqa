import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@theme";

export interface ProgressStage {
  id: string;
  label: string;
  state: "pending" | "active" | "done" | "failed";
}

/** Determinate stage indicator for Compile Progress (§7.8). */
export function ProgressStageList({ stages }: { stages: ProgressStage[] }) {
  return (
    <View style={styles.list}>
      {stages.map((s) => (
        <View key={s.id} style={styles.row}>
          <View style={[styles.dot, dotStyle(s.state)]} />
          <Text style={[typography.body, s.state === "pending" && { color: colors.textMuted }]}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function dotStyle(state: ProgressStage["state"]) {
  switch (state) {
    case "active": return { backgroundColor: colors.cyan };
    case "done":   return { backgroundColor: colors.lime };
    case "failed": return { backgroundColor: colors.red };
    case "pending":
    default:       return { backgroundColor: colors.textDim };
  }
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
