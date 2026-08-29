import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { radius, spacing, useAppTheme, useThemeStyles, type AppTheme, type ThemeColors } from "@theme";

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
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const isDisabled = !!(disabled || loading);
  const palette = paletteFor(colors, variant);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      hitSlop={8}
      activeOpacity={0.72}
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

function paletteFor(colors: ThemeColors, v: ButtonVariant) {
  switch (v) {
    case "primary": return { bg: colors.lime, fg: colors.onAccent, border: colors.lime };
    case "secondary": return { bg: colors.surfaceRaised, fg: colors.text, border: colors.borderStrong };
    case "ghost": return { bg: "transparent", fg: colors.text, border: colors.border };
    case "danger": return { bg: colors.dangerSurface, fg: colors.red, border: colors.red };
  }
}

const createStyles = (_theme: AppTheme) => ({
  base: {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  block: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "700", letterSpacing: 0.1 },
});

export const PrimaryButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="primary" />;
export const SecondaryButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="secondary" />;
export const GhostButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="ghost" />;
export const DangerButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="danger" />;
