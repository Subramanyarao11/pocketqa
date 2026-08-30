import { Text, type TextStyle } from "react-native";
import { makeStyles, radius, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

export interface CodeChipProps {
  children: string;
  style?: TextStyle;
}

/** Inline monospaced value — selectors, IDs, anything copied verbatim. */
export function CodeChip({ children, style }: CodeChipProps) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return <Text style={[typography.mono, styles.chip, style]}>{children}</Text>;
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  chip: {
    color: colors.cyan,
    backgroundColor: colors.infoSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
}));
