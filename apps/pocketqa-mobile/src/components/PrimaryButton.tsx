import React from 'react';
import {TouchableOpacity, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({title, onPress, disabled}: PrimaryButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  disabled: {opacity: 0.5},
  text: {...typography.label, color: colors.text},
});
