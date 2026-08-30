import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import {
  controlSize,
  layout,
  radius,
  spacing,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
  type ThemeColors,
} from "@theme";

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
  const { colors, typography } = useAppTheme();
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
        { backgroundColor: palette.bg, borderColor: palette.border },
        isDisabled && styles.disabled,
        block && styles.block,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[typography.button, { color: palette.fg }]}>{label}</Text>
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

const createStyles = makeStyles((_theme: AppTheme) => ({
  base: {
    minHeight: controlSize.md,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    ...layout.center,
  },
  block: { alignSelf: "stretch" },
  disabled: { opacity: 0.5 },
  row: { ...layout.row, gap: spacing.sm },
}));

export const PrimaryButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="primary" />;
export const SecondaryButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="secondary" />;
export const GhostButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="ghost" />;
export const DangerButton = (p: Omit<ButtonProps, "variant">) => <Button {...p} variant="danger" />;
