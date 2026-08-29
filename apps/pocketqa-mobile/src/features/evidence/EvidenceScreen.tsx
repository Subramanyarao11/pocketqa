import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {AppScreen} from '../../components/AppScreen';
import {colors, typography} from '../../theme';

export function EvidenceScreen(): React.JSX.Element {
  return (
    <AppScreen>
      <View style={styles.container}>
        <Text style={styles.title}>Evidence Report</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  title: {...typography.h2, color: colors.text},
});
