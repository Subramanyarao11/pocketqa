import { Text, View } from "react-native";
import {
  layout,
  radius,
  spacing,
  toneForeground,
  toneSurface,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
  type StatusTone,
} from "@theme";

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  icon?: React.ReactNode;
}

/** Semantic pill: text + optional icon + colour that maps to a documented tone. */
export function StatusPill({ label, tone = "dim", icon }: StatusPillProps) {
  const { colors, typography } = useAppTheme();
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
      <Text style={[typography.pill, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  root: {
    ...layout.row,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
}));
