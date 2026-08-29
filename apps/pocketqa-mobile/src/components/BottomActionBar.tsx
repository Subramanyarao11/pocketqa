import React from 'react';
import {View, StyleSheet} from 'react-native';
import {colors, spacing} from '../theme';

interface BottomActionBarProps {
  children: React.ReactNode;
}

export function BottomActionBar({children}: BottomActionBarProps): React.JSX.Element {
  return <View style={styles.bar}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
});
