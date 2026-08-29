import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, spacing } from "@theme";

export type CardTone = "surface" | "callout" | "warn" | "danger" | "info";

export function Card({
  children,
  tone = "surface",
  style,
}: PropsWithChildren<{ tone?: CardTone; style?: ViewStyle }>) {
  return <View style={[styles.base, palette(tone), style]}>{children}</View>;
}

function palette(tone: CardTone): ViewStyle {
  switch (tone) {
    case "surface": return { backgroundColor: colors.surfaceRaised, borderColor: colors.border };
    case "callout": return { backgroundColor: "rgba(199,255,74,0.06)", borderColor: colors.lime };
    case "warn":    return { backgroundColor: "rgba(242,184,75,0.06)", borderColor: colors.amber };
    case "danger":  return { backgroundColor: "rgba(255,102,122,0.06)", borderColor: colors.red };
    case "info":    return { backgroundColor: "rgba(89,217,255,0.05)", borderColor: colors.cyan };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
