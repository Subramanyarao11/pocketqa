import React from 'react';
import {View, StyleSheet} from 'react-native';
import {colors, spacing} from '../theme';

interface CardProps {
  children: React.ReactNode;
}

export function Card({children}: CardProps): React.JSX.Element {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
