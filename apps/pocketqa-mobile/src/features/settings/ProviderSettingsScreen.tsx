import { Text } from "react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, Card, TopBar } from "@components";
import { typography } from "@theme";

export function ProviderSettingsScreen({ navigation }: ScreenProps<"ProviderSettings">) {
  return (
    <>
      <TopBar title="Providers" subtitle="Credentials stored in native vault" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <Text style={typography.h2}>Sarvam / OpenAI</Text>
          <Text style={typography.bodyMuted}>
            Keys are submitted directly to the native keystore-backed vault. JS only receives a
            masked identifier (`••••7F2A`).
          </Text>
        </Card>
      </AppScreen>
    </>
  );
}
