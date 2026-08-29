import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, BottomActionBar, Card, GhostButton, PrimaryButton, TopBar } from "@components";
import { colors, spacing, typography } from "@theme";
import { PocketQaNative } from "@native";

export function DisclosureScreen({ navigation }: ScreenProps<"Disclosure">) {
  const [consent, setConsent] = useState(false);

  return (
    <>
      <TopBar title="Capture disclosure" onBack={() => navigation.goBack()} />
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

        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setConsent((c) => !c)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
        >
          <View style={[styles.box, { borderColor: consent ? colors.lime : colors.borderStrong, backgroundColor: consent ? colors.lime : "transparent" }]}>
            {consent && <Text style={{ color: "#0A0F14", fontWeight: "900" }}>✓</Text>}
          </View>
          <Text style={[typography.body, { flex: 1 }]}>
            I understand what PocketQA can inspect and where it can act.
          </Text>
        </TouchableOpacity>

        <Text style={typography.bodyMuted}>
          A consent record (version + UTC timestamp) is stored locally for audit.
        </Text>
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Read privacy" onPress={() => navigation.navigate("Settings")} />
        <View style={{ flex: 1 }} />
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

const styles = StyleSheet.create({
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  box: {
    width: 24, height: 24,
    borderRadius: 6, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
});
