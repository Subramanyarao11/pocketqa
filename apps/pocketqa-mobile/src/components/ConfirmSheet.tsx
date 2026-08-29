import { Modal, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@theme";
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

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
