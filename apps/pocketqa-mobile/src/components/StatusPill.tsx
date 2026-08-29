import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, toneColor, type StatusTone } from "@theme";

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  icon?: React.ReactNode;
}

/** Semantic pill: text + optional icon + colour that maps to a documented tone. */
export function StatusPill({ label, tone = "dim", icon }: StatusPillProps) {
  const fg = toneColor[tone];
  const bg = tone === "dim" ? "transparent" : `${fg}20`;
  return (
    <View
      style={[styles.root, { backgroundColor: bg, borderColor: tone === "dim" ? colors.border : "transparent" }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
});
