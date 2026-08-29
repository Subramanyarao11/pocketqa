import { Text } from "react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, Card, TopBar } from "@components";
import { useAppTheme } from "@theme";

export function DataAndPrivacyScreen({ navigation }: ScreenProps<"DataAndPrivacy">) {
  const { typography } = useAppTheme();
  return (
    <>
      <TopBar title="Data and privacy" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <Text style={typography.h2}>Retention</Text>
          <Text style={typography.bodyMuted}>
            Raw session evidence retention defaults to 7 days; approved-test evidence persists
            until deletion. Execution logs default to 30 days.
          </Text>
        </Card>
        <Card tone="info">
          <Text style={typography.h2}>What leaves the device</Text>
          <Text style={typography.bodyMuted}>
            Nothing, unless you explicitly share an artifact or enable a connected provider for a
            single operation.
          </Text>
        </Card>
      </AppScreen>
    </>
  );
}
