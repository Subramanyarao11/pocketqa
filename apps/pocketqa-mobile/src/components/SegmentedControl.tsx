import { Text, TouchableOpacity, View } from "react-native";
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

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Receives the resolved foreground colour so the icon tracks selection. */
  renderIcon?: (color: string) => React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Intent input mode". */
  accessibilityLabel: string;
}

/** Mutually exclusive mode switch for two or three short options. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        const fg = selected ? colors.onAccent : colors.text;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            {option.renderIcon?.(selected ? colors.onAccent : colors.textMuted)}
            <Text style={[typography.button, { color: fg }]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  group: { ...layout.row, gap: spacing.sm },
  segment: {
    ...layout.row,
    gap: spacing.sm,
    minHeight: controlSize.minTouch,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentSelected: { backgroundColor: colors.lime, borderColor: colors.lime },
}));
