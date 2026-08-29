import { Text, TouchableOpacity, View } from "react-native";
import { Square } from "lucide-react-native";
import { radius, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

/**
 * Sticky Stop control — must remain reachable during replay/exploration
 * regardless of scroll position or dynamic type (§9.4).
 */
export function PersistentStopButton({ onStop, label = "Stop" }: { onStop: () => void; label?: string }) {
  const { colors } = useAppTheme();
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
        <Square color={colors.onAccent} size={16} />
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  wrap: {
    position: "absolute",
    right: spacing.xl,
    bottom: spacing.xl,
  },
  btn: {
    backgroundColor: colors.red,
    minWidth: 96,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    shadowColor: colors.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  label: { color: colors.onAccent, fontWeight: "700", fontSize: 14, letterSpacing: 0.2 },
});
