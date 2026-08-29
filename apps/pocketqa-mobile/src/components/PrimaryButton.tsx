import React from 'react';
import {TouchableOpacity, Text, StyleSheet} from 'react-native';
import {spacing, useAppTheme} from '../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({title, onPress, disabled}: PrimaryButtonProps): React.JSX.Element {
  const {colors, typography} = useAppTheme();
  return (
    <TouchableOpacity
      style={[styles.button, {backgroundColor: colors.lime}, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}>
      <Text style={[styles.text, typography.h2, {color: colors.onAccent}]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  disabled: {opacity: 0.5},
  text: {fontSize: 14, fontWeight: '700'},
});
