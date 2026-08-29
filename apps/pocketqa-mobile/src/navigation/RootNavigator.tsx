import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";
import { StartupGateScreen } from "@features/onboarding/StartupGateScreen";
import { WelcomeScreen } from "@features/onboarding/WelcomeScreen";
import { DisclosureScreen } from "@features/onboarding/DisclosureScreen";
import { ReadinessScreen } from "@features/onboarding/ReadinessScreen";
import { HomeScreen } from "@features/home/HomeScreen";
import { IntentScreen } from "@features/intent/IntentScreen";
import { CaptureReadyScreen } from "@features/capture/CaptureReadyScreen";
import { CaptureStatusScreen } from "@features/capture/CaptureStatusScreen";
import { CompileProgressScreen } from "@features/capture/CompileProgressScreen";
import { ReviewTestScreen } from "@features/review/ReviewTestScreen";
import { ReplayMissionControlScreen } from "@features/replay/ReplayMissionControlScreen";
import { EvidenceScreen } from "@features/evidence/EvidenceScreen";
import { AgentLabScreen } from "@features/explorer/AgentLabScreen";
import { MissionReviewScreen } from "@features/explorer/MissionReviewScreen";
import { ExplorerMissionControlScreen } from "@features/explorer/ExplorerMissionControlScreen";
import { SettingsScreen } from "@features/settings/SettingsScreen";
import { SelectorCandidatesScreen } from "@features/review/SelectorCandidatesScreen";
import { EvidenceDetailScreen } from "@features/evidence/EvidenceDetailScreen";
import { ProviderSettingsScreen } from "@features/settings/ProviderSettingsScreen";
import { DataAndPrivacyScreen } from "@features/settings/DataAndPrivacyScreen";
import { AboutAndLimitsScreen } from "@features/settings/AboutAndLimitsScreen";
import { colors } from "@theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.lime,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.cyan,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="StartupGate" component={StartupGateScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Disclosure" component={DisclosureScreen} />
        <Stack.Screen name="Readiness" component={ReadinessScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Intent" component={IntentScreen} />
        <Stack.Screen name="CaptureReady" component={CaptureReadyScreen} />
        <Stack.Screen name="CaptureStatus" component={CaptureStatusScreen} />
        <Stack.Screen name="CompileProgress" component={CompileProgressScreen} />
        <Stack.Screen name="ReviewTest" component={ReviewTestScreen} />
        <Stack.Screen name="ReplayMissionControl" component={ReplayMissionControlScreen} />
        <Stack.Screen name="Evidence" component={EvidenceScreen} />
        <Stack.Screen name="AgentLab" component={AgentLabScreen} />
        <Stack.Screen name="MissionReview" component={MissionReviewScreen} />
        <Stack.Screen name="ExplorerMissionControl" component={ExplorerMissionControlScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="SelectorCandidates" component={SelectorCandidatesScreen} options={{ presentation: "modal" }} />
        <Stack.Screen name="EvidenceDetail" component={EvidenceDetailScreen} options={{ presentation: "modal" }} />
        <Stack.Screen name="ProviderSettings" component={ProviderSettingsScreen} />
        <Stack.Screen name="DataAndPrivacy" component={DataAndPrivacyScreen} />
        <Stack.Screen name="AboutAndLimits" component={AboutAndLimitsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
