import { Text, TouchableOpacity, View } from "react-native";
import { Square } from "lucide-react-native";
import {
  accentGlow,
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
 * Sticky Stop control — must remain reachable during replay/exploration
 * regardless of scroll position or dynamic type (§9.4).
 */
export function PersistentStopButton({ onStop, label = "Stop" }: { onStop: () => void; label?: string }) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <TouchableOpacity
        onPress={onStop}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Stop the current operation"
        hitSlop={12}
        testID="persistent-stop"
      >
        <Square color={colors.onAccent} size={iconSize.sm} />
        <Text style={[typography.button, { color: colors.onAccent }]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  wrap: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
  },
  btn: {
    backgroundColor: colors.red,
    minWidth: 96,
    minHeight: controlSize.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    ...layout.row,
    ...layout.center,
    gap: spacing.sm,
    ...accentGlow(colors.red),
  },
}));
