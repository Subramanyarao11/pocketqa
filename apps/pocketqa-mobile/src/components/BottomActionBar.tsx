import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@theme";

/** Sticky primary/secondary action pair, respects safe area (§8). */
export function BottomActionBar({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.wrap}>
      <View style={styles.row}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
});
