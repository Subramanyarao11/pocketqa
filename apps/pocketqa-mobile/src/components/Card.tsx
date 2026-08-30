import { type PropsWithChildren } from "react";
import { View, type ViewStyle } from "react-native";
import {
  makeStyles,
  radius,
  spacing,
  useAppTheme,
  useThemeStyles,
  type AppTheme,
  type ThemeColors,
} from "@theme";

export type CardTone = "surface" | "callout" | "warn" | "danger" | "info";

export function Card({
  children,
  tone = "surface",
  style,
}: PropsWithChildren<{ tone?: CardTone; style?: ViewStyle }>) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return <View style={[styles.base, palette(colors, tone), style]}>{children}</View>;
}

function palette(colors: ThemeColors, tone: CardTone): ViewStyle {
  switch (tone) {
    case "surface": return { backgroundColor: colors.surface, borderColor: colors.border };
    case "callout": return { backgroundColor: colors.successSurface, borderColor: colors.border, borderLeftColor: colors.lime, borderLeftWidth: 3 };
    case "warn":    return { backgroundColor: colors.warningSurface, borderColor: colors.border, borderLeftColor: colors.amber, borderLeftWidth: 3 };
    case "danger":  return { backgroundColor: colors.dangerSurface, borderColor: colors.border, borderLeftColor: colors.red, borderLeftWidth: 3 };
    case "info":    return { backgroundColor: colors.infoSurface, borderColor: colors.border, borderLeftColor: colors.cyan, borderLeftWidth: 3 };
  }
}

const createStyles = makeStyles(({ elevation }: AppTheme) => ({
  base: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.card,
  },
}));
