import { Text } from "react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, Card, TopBar } from "@components";
import { useAppTheme } from "@theme";

export function AboutAndLimitsScreen({ navigation }: ScreenProps<"AboutAndLimits">) {
  const { typography } = useAppTheme();
  return (
    <>
      <TopBar title="About & limits" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <Text style={typography.eyebrow}>PocketQA</Text>
          <Text style={typography.body}>Private mobile QA workspace · Tech Phantoms</Text>
        </Card>
        <Card tone="info">
          <Text style={typography.h2}>Policy boundary</Text>
          <Text style={typography.bodyMuted}>
            Author-and-Replay is the core product mode. Explorer Lab is an opt-in internal build; it must not be
            distributed on Google Play using an AccessibilityService execution backend.
          </Text>
        </Card>
      </AppScreen>
    </>
  );
}
