import { Text, TouchableOpacity } from "react-native";
import {
  spacing,
  toneForeground,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
  type StatusTone,
} from "@theme";

export interface LinkButtonProps {
  label: string;
  onPress: () => void;
  /** `cyan` for navigation, `red` for destructive text actions. */
  tone?: Extract<StatusTone, "cyan" | "red" | "dim">;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * Inline text action. Exists so "Remove"/"Delete"/"View candidates" get a real
 * touch target instead of a bare `<Text>` sized to its own glyphs.
 */
export function LinkButton({
  label,
  onPress,
  tone = "cyan",
  accessibilityLabel,
  disabled,
  testID,
}: LinkButtonProps) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={[styles.pressable, disabled && styles.disabled]}
      testID={testID}
    >
      <Text style={[typography.button, { color: toneForeground(colors, tone) }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  pressable: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
}));
