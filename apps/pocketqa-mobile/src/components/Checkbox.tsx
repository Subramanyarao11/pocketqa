import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { Check } from "lucide-react-native";
import {
  controlSize,
  iconSize,
  layout,
  radius,
  spacing,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
} from "@theme";

/**
 * The box on its own, with no accessibility identity. Use inside a control that
 * already announces itself as a checkbox; use `Checkbox` everywhere else.
 */
export function CheckboxIndicator({ checked }: { checked: boolean }) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, checked ? styles.boxChecked : styles.boxUnchecked]}
    >
      {checked && <Check color={colors.onAccent} size={iconSize.sm} strokeWidth={3} />}
    </View>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Rendered beside the box and used as the spoken name unless overridden. */
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

/** Box plus label as a single tap target, so the label is never dead space. */
export function Checkbox({
  checked,
  onChange,
  label,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  style,
}: CheckboxProps) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.disabled, style]}
      onPress={() => !disabled && onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
    >
      <CheckboxIndicator checked={checked} />
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
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    ...layout.center,
  },
  boxChecked: { borderColor: colors.lime, backgroundColor: colors.lime },
  boxUnchecked: { borderColor: colors.borderStrong, backgroundColor: "transparent" },
}));
