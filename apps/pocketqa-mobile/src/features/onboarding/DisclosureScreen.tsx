import { useState } from "react";
import { Text } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, Checkbox, GhostButton, PrimaryButton, Spacer, TopBar,
} from "@components";
import { useAppTheme } from "@theme";
import { PocketQaNative } from "@native";

export function DisclosureScreen({ navigation }: ScreenProps<"Disclosure">) {
  const { typography } = useAppTheme();
  const [consent, setConsent] = useState(false);

  return (
    <>
      <TopBar title="Capture and privacy" subtitle="Review before enabling" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <Text style={typography.eyebrow}>What PocketQA does</Text>
          <Text style={typography.body}>
            During a session, PocketQA can inspect and record screen content, interface labels,
            and your actions inside the app you select. Captures stay on this device unless you
            explicitly export them or enable a connected analysis provider.
          </Text>
          <Text style={typography.body}>
            Passwords and likely sensitive fields are redacted. You can stop at any time.
          </Text>
        </Card>
        <Card tone="info">
          <Text style={typography.h2}>Boundaries that never move</Text>
          <Text style={typography.bodyMuted}>
            • Only explicitly allowlisted apps are in scope.{"\n"}
            • Payments, purchases, accounts, permissions, sensitive input, destructive actions,
            communications, system UI, and other apps are blocked.{"\n"}
            • Ambiguous selectors stop the run rather than guess.{"\n"}
            • A model never dispatches actions to your device.
          </Text>
        </Card>

        <Checkbox
          checked={consent}
          onChange={setConsent}
          label="I understand what PocketQA can inspect and where it can act."
          accessibilityHint="Toggles capture disclosure consent."
        />

        <Text style={typography.bodyMuted}>
          A consent record (version + UTC timestamp) is stored locally for audit.
        </Text>
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Read privacy" onPress={() => navigation.navigate("Settings")} />
        <Spacer />
        <PrimaryButton
          label="I agree"
          disabled={!consent}
          onPress={async () => {
            await PocketQaNative.recordConsent();
            navigation.navigate("Readiness");
          }}
        />
      </BottomActionBar>
    </>
  );
}