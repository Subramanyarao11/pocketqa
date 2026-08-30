import { Text, TouchableOpacity } from "react-native";
import {
  controlSize,
  layout,
  radius,
  spacing,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
} from "@theme";

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /**
   * `radio` for single-select filters (the default), `checkbox` for
   * independently toggleable ones. Drives what a screen reader announces.
   */
  role?: "radio" | "checkbox";
  accessibilityLabel?: string;
  testID?: string;
}

/** Selectable filter chip. `StatusPill` is its read-only counterpart. */
export function Chip({ label, selected, onPress, role = "radio", accessibilityLabel, testID }: ChipProps) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === "radio" ? { selected } : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.chip, selected && styles.chipSelected]}
      testID={testID}
    >
      <Text style={[typography.pill, { color: selected ? colors.onAccent : colors.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  chip: {
    minHeight: controlSize.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...layout.center,
  },
  chipSelected: { backgroundColor: colors.lime, borderColor: colors.lime },
}));
