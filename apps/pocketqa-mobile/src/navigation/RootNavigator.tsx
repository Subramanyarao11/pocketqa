import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {RootStackParamList} from './types';
import {WelcomeScreen} from '../features/onboarding/WelcomeScreen';
import {HomeScreen} from '../features/home/HomeScreen';
import {IntentScreen} from '../features/intent/IntentScreen';
import {CaptureStatusScreen} from '../features/capture/CaptureStatusScreen';
import {ReviewTestScreen} from '../features/review/ReviewTestScreen';
import {ReplayScreen} from '../features/replay/ReplayScreen';
import {EvidenceScreen} from '../features/evidence/EvidenceScreen';
import {ExplorerScreen} from '../features/explorer/ExplorerScreen';
import {SettingsScreen} from '../features/settings/SettingsScreen';
import {colors} from '../theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerStyle: {backgroundColor: colors.surface},
        headerTintColor: colors.text,
        contentStyle: {backgroundColor: colors.background},
      }}>
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen name="Home" component={HomeScreen} options={{title: 'PocketQA'}} />
      <Stack.Screen name="Intent" component={IntentScreen} options={{title: 'New Test'}} />
      <Stack.Screen
        name="CaptureStatus"
        component={CaptureStatusScreen}
        options={{title: 'Capturing'}}
      />
      <Stack.Screen
        name="ReviewTest"
        component={ReviewTestScreen}
        options={{title: 'Review Test'}}
      />
      <Stack.Screen name="Replay" component={ReplayScreen} options={{title: 'Replay'}} />
      <Stack.Screen
        name="Evidence"
        component={EvidenceScreen}
        options={{title: 'Evidence'}}
      />
      <Stack.Screen
        name="Explorer"
        component={ExplorerScreen}
        options={{title: 'Explorer'}}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Settings'}}
      />
    </Stack.Navigator>
  );
}
