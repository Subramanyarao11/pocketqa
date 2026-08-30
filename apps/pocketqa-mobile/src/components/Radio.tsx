import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
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

/**
 * The ring and dot with no accessibility identity of their own. Most radio
 * groups here are whole cards that already carry `accessibilityRole="radio"`,
 * so the indicator must stay silent or the option is announced twice.
 */
export function RadioIndicator({ selected }: { selected: boolean }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { borderColor: selected ? colors.lime : colors.borderStrong }]}
    >
      {selected && <View style={styles.dot} />}
    </View>
  );
}

export interface RadioProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

/** Indicator plus label as one option row. */
export function Radio({
  selected,
  onSelect,
  label,
  accessibilityLabel,
  disabled,
  style,
}: RadioProps) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.disabled, style]}
      onPress={() => !disabled && onSelect()}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <RadioIndicator selected={selected} />
      <Text style={[typography.body, styles.label]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  row: {
    ...layout.row,
    minHeight: controlSize.minTouch,
    paddingVertical: spacing.md,
  },
  disabled: { opacity: 0.5 },
  label: { flex: 1 },
  ring: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    ...layout.center,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
  },
}));
