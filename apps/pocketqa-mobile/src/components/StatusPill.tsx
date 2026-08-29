import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../theme';

interface StatusPillProps {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info';
}

const variantColors = {
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.secondary,
};

export function StatusPill({label, variant}: StatusPillProps): React.JSX.Element {
  return (
    <View style={[styles.pill, {backgroundColor: variantColors[variant] + '20'}]}>
      <Text style={[styles.text, {color: variantColors[variant]}]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {borderRadius: 99, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm + 4},
  text: {...typography.caption, fontWeight: '600'},
});
