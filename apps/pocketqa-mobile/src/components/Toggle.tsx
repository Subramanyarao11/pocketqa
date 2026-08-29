import { TouchableOpacity, View } from "react-native";
import { radius, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

/** Simple accessible toggle switch. */
export function Toggle({
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => !disabled && onChange(!value)}
      style={[styles.track, { backgroundColor: value ? colors.lime : colors.borderStrong, opacity: disabled ? 0.4 : 1 }]}
      hitSlop={8}
    >
      <View style={[styles.thumb, { left: value ? 22 : 2 }]} />
    </TouchableOpacity>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  track: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  thumb: {
    position: "absolute",
    top: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
