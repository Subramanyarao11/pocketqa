import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@theme";
import { PrimaryButton } from "./Button";

export interface EmptyStateProps {
  title: string;
  detail: string;
  action?: { label: string; onPress: () => void };
  icon?: React.ReactNode;
}

/** Single explanation + one primary action (§8). */
export function EmptyState({ title, detail, action, icon }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {icon}
      <Text style={typography.title}>{title}</Text>
      <Text style={[typography.bodyMuted, styles.detail]}>{detail}</Text>
      {action && <PrimaryButton label={action.label} onPress={action.onPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 16,
  },
  detail: { textAlign: "center", maxWidth: 320 },
});
