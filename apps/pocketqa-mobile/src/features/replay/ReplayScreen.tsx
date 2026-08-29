import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {AppScreen} from '../../components/AppScreen';
import {useAppTheme} from '../../theme';

export function ReplayScreen(): React.JSX.Element {
  const {typography} = useAppTheme();
  return (
    <AppScreen>
      <View style={styles.container}>
        <Text style={typography.h2}>Replay</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});
