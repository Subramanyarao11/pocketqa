import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing, useThemeStyles, type AppTheme } from "@theme";

/** Sticky primary/secondary action pair, respects safe area (§8). */
export function BottomActionBar({ children }: PropsWithChildren) {
  const styles = useThemeStyles(createStyles);
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.wrap}>
      <View style={styles.row}>{children}</View>
    </SafeAreaView>
  );
}

const createStyles = ({ colors, isDark }: AppTheme) => ({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: isDark ? 0 : 0.06,
    shadowRadius: 10,
    elevation: isDark ? 0 : 4,
  },
  row: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
});
