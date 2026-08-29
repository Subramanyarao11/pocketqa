import { Modal, Text, View } from "react-native";
import { radius, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import { DangerButton, GhostButton, PrimaryButton } from "./Button";

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  detail: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirmation used for destructive/warning acknowledgements (§8). */
export function ConfirmSheet({
  visible,
  title,
  detail,
  confirmLabel,
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Text style={typography.title}>{title}</Text>
          <Text style={typography.bodyMuted}>{detail}</Text>
          <View style={styles.actions}>
            <GhostButton label={cancelLabel} onPress={onCancel} />
            {variant === "danger"
              ? <DangerButton label={confirmLabel} onPress={onConfirm} />
              : <PrimaryButton label={confirmLabel} onPress={onConfirm} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = ({ colors, isDark }: AppTheme) => ({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: isDark ? 0.25 : 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
