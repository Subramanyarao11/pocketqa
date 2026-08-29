import { Text, View } from "react-native";
import { radius, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import { PrimaryButton } from "./Button";

export interface EmptyStateProps {
  title: string;
  detail: string;
  action?: { label: string; onPress: () => void };
  icon?: React.ReactNode;
}

/** Single explanation + one primary action (§8). */
export function EmptyState({ title, detail, action, icon }: EmptyStateProps) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.root}>
      {icon}
      <Text style={typography.title}>{title}</Text>
      <Text style={[typography.bodyMuted, styles.detail]}>{detail}</Text>
      {action && <PrimaryButton label={action.label} onPress={action.onPress} />}
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  root: {
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.panel,
    backgroundColor: colors.surface,
    minHeight: 240,
    justifyContent: "center",
  },
  detail: { textAlign: "center", maxWidth: 320 },
});
