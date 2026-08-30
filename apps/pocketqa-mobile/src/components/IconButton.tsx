import { TouchableOpacity } from "react-native";
import { controlSize, layout, makeStyles, radius, useThemeStyles, type AppTheme } from "@theme";

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  /** Required: an icon-only control has no visible name. */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

/**
 * Square bordered control for a single icon. Renders at 40dp but claims the
 * full 44dp target through `hitSlop`, so rows of them stay compact.
 */
export function IconButton({ icon, onPress, accessibilityLabel, disabled, testID }: IconButtonProps) {
  const styles = useThemeStyles(createStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={(controlSize.minTouch - controlSize.tileSm) / 2}
      activeOpacity={0.72}
      style={[styles.button, disabled && styles.disabled]}
      testID={testID}
    >
      {icon}
    </TouchableOpacity>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  button: {
    width: controlSize.tileSm,
    height: controlSize.tileSm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...layout.center,
  },
  disabled: { opacity: 0.4 },
}));
