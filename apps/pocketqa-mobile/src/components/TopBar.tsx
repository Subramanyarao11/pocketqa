import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { colors, spacing, typography } from "@theme";

export interface TopBarProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}

/** Predictable-height top bar with optional back + context action. */
export function TopBar({ title, subtitle, onBack, right }: TopBarProps) {
  return (
    <View style={styles.root}>
      <View style={styles.leftGroup}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.backBtn}
          >
            <ChevronLeft color={colors.text} size={20} />
          </TouchableOpacity>
        )}
        <View style={{ minWidth: 0, flexShrink: 1 }}>
          <Text style={typography.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={typography.bodyMuted} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leftGroup: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
