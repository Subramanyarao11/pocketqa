import { Text, View } from "react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, BottomActionBar, Card, PrimaryButton, StatusPill } from "@components";
import { spacing, typography } from "@theme";

export function WelcomeScreen({ navigation }: ScreenProps<"Welcome">) {
  return (
    <>
      <AppScreen>
        <Text style={typography.eyebrow}>PocketQA · Tech Phantoms</Text>
        <Text style={[typography.title, { fontSize: 26, lineHeight: 32 }]}>Show one mobile flow. Get the regression test.</Text>
        <Text style={typography.body}>
          Say what must remain true. Demonstrate the flow once. PocketQA compiles a
          reviewable test, replays it deterministically, and produces evidence you can
          share — all on this device.
        </Text>
        <Card>
          <StatusPill label="Local by default" tone="lime" />
          <Text style={typography.bodyMuted}>
            The core loop works with airplane mode on. Sarvam and OpenAI are optional and single-operation.
          </Text>
        </Card>
        <Card>
          <StatusPill label="Human review before action" tone="cyan" />
          <Text style={typography.bodyMuted}>
            AI proposes; a deterministic executor is the only thing that acts. Every action is inside an allowlisted app.
          </Text>
        </Card>
      </AppScreen>
      <BottomActionBar>
        <View style={{ flex: 1 }} />
        <PrimaryButton label="Continue" onPress={() => navigation.navigate("Disclosure")} />
      </BottomActionBar>
    </>
  );
}
