import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../theme';

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({title, description}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg},
  title: {...typography.h3, color: colors.text, marginBottom: spacing.sm},
  description: {...typography.body, color: colors.textSecondary, textAlign: 'center'},
});
