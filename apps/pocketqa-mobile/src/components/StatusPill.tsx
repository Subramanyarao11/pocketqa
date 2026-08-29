import { Text, View } from "react-native";
import { radius, spacing, toneForeground, toneSurface, useAppTheme, useThemeStyles, type AppTheme, type StatusTone } from "@theme";

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  icon?: React.ReactNode;
}

/** Semantic pill: text + optional icon + colour that maps to a documented tone. */
export function StatusPill({ label, tone = "dim", icon }: StatusPillProps) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const fg = toneForeground(colors, tone);
  const bg = toneSurface(colors, tone);
  return (
    <View
      style={[styles.root, { backgroundColor: bg, borderColor: colors.border }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const createStyles = (_theme: AppTheme) => ({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, lineHeight: 15, fontWeight: "700", letterSpacing: 0.25 },
});
