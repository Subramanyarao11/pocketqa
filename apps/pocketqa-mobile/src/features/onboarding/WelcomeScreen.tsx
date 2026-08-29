import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/types';
import {PrimaryButton} from '../../components/PrimaryButton';
import {colors, spacing, typography} from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export function WelcomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PocketQA</Text>
      <Text style={styles.subtitle}>AI-powered mobile testing</Text>
      <PrimaryButton title="Get Started" onPress={() => navigation.navigate('Home')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {...typography.h1, color: colors.text, marginBottom: spacing.sm},
  subtitle: {...typography.body, color: colors.textSecondary, marginBottom: spacing.xl},
});
