import { type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { layout, makeStyles, spacing, useThemeStyles, type AppTheme } from "@theme";

/** Sticky primary/secondary action pair, respects safe area (§8). */
export function BottomActionBar({ children }: PropsWithChildren) {
  const styles = useThemeStyles(createStyles);
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.wrap}>
      <View style={styles.row}>{children}</View>
    </SafeAreaView>
  );
}

const createStyles = makeStyles(({ colors, elevation }: AppTheme) => ({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...elevation.barTop,
  },
  row: {
    ...layout.row,
    // Three labelled actions overflow a phone width (Evidence does this). Wrap
    // to a second line rather than letting the last one run off the edge.
    flexWrap: "wrap",
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
}));
