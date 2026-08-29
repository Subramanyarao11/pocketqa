import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing, typography } from "@theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}

function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  block,
  icon,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const isDisabled = !!(disabled || loading);
  const palette = paletteFor(variant, isDisabled);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      hitSlop={8}
      style={[
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: isDisabled ? 0.5 : 1 },
        block && styles.block,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function paletteFor(v: ButtonVariant, _disabled: boolean) {
  switch (v) {
    case "primary": return { bg: colors.lime, fg: "#081014", border: colors.lime };
    case "secondary": return { bg: colors.surfaceRaised, fg: colors.text, border: colors.borderStrong };
    case "ghost": return { bg: "transparent", fg: colors.text, border: colors.border };
    case "danger": return { bg: "transparent", fg: colors.red, border: colors.red };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  block: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { ...typography.body, fontWeight: "600" },
});

export const PrimaryButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="primary" />;
export const SecondaryButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="secondary" />;
export const GhostButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="ghost" />;
export const DangerButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="danger" />;
