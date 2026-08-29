import React from 'react';
import {View, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors} from '../theme';

interface AppScreenProps {
  children: React.ReactNode;
}

export function AppScreen({children}: AppScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  container: {flex: 1, backgroundColor: colors.background},
});
