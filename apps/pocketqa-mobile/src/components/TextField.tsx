import { forwardRef, type ComponentRef } from "react";
import {
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ViewStyle,
} from "react-native";
import {
  controlSize,
  layout,
  radius,
  spacing,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
} from "@theme";

export type TextFieldVariant = "single" | "multiline" | "title";

export interface TextFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  /** Required: every input needs a spoken name, the visible label may be absent. */
  accessibilityLabel: string;
  variant?: TextFieldVariant;
  placeholder?: string;
  /** Visible lines for `multiline`. Ignored otherwise. */
  rows?: number;
  leadingIcon?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  /** Renders `used / maxLength` underneath. Requires `maxLength`. */
  showCounter?: boolean;
  editable?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/** Line height used to derive the height of a multiline field from `rows`. */
const ROW_HEIGHT = 22;

/**
 * The app's only text input. Owns the border, radius, padding and placeholder
 * colour so a field can't drift from its neighbours, and keeps every variant
 * above the minimum touch target.
 */
export const TextField = forwardRef<
  ComponentRef<typeof TextInput>,
  TextFieldProps
>(function TextFieldInner(
  {
    value,
    onChangeText,
    accessibilityLabel,
    variant = "single",
    placeholder,
    rows = 3,
    leadingIcon,
    keyboardType,
    maxLength,
    showCounter,
    editable = true,
    style,
    testID,
  },
  ref,
) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const multiline = variant === "multiline";
  const height = multiline
    ? { minHeight: rows * ROW_HEIGHT + spacing.md * 2 }
    : { minHeight: controlSize.md };

  return (
    <View style={style}>
      <View style={[styles.frame, height, !editable && styles.disabled]}>
        {leadingIcon}
        <TextInput
          ref={ref}
          style={[styles.input, variant === "title" && typography.subtitle, multiline && styles.multiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          multiline={multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          textAlignVertical={multiline ? "top" : "center"}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
        />
      </View>
      {showCounter && maxLength != null && (
        <Text style={[typography.metadata, styles.counter]}>
          {`${value.length} / ${maxLength}`}
        </Text>
      )}
    </View>
  );
});

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  frame: {
    ...layout.row,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.5 },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  multiline: {
    alignSelf: "stretch",
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  counter: { alignSelf: "flex-end", marginTop: spacing.xxs },
}));
