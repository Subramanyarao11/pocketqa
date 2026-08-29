import { StyleSheet, Text, View } from "react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, BottomActionBar, Card, GhostButton, PrimaryButton, StatusPill, TopBar } from "@components";
import { PocketQaNative } from "@native";
import { spacing, useAppTheme } from "@theme";

export function CaptureReadyScreen({ navigation, route }: ScreenProps<"CaptureReady">) {
  const { typography } = useAppTheme();
  return (
    <>
      <TopBar title="Ready to capture" subtitle="Review scope before switching apps" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card tone="callout">
          <Text style={typography.h2}>Before we switch to the Demo Shop</Text>
          <Text style={typography.bodyMuted}>
            A native overlay (or persistent notification) will show recording state, step count,
            Pause, Finish, and Stop while you demonstrate the flow.
          </Text>
        </Card>
        <Card>
          <Text style={typography.eyebrow}>What will be captured</Text>
          <Text style={typography.body}>• Screenshots at stable states</Text>
          <Text style={typography.body}>• Normalised accessibility tree</Text>
          <Text style={typography.body}>• Your normalised actions and their targets</Text>
          <Text style={typography.body}>• Redacted OCR when hierarchy text is thin</Text>
        </Card>
        <Card tone="info">
          <Text style={typography.eyebrow}>Hard stops</Text>
          <Text style={typography.body}>Package changes, sensitive fields, system dialogs,</Text>
          <Text style={typography.body}>and blocked categories all halt the session immediately.</Text>
        </Card>
        <View style={styles.rowStatus}>
          <StatusPill label="Service enabled" tone="lime" />
          <StatusPill label="Demo Shop reset" tone="cyan" />
          <StatusPill label="Redaction on" tone="lime" />
        </View>
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Start demonstration"
          onPress={async () => {
            const { sessionId } = await PocketQaNative.startCapture({ intentId: route.params.intentId, fixture: "coupon-retry" });
            navigation.replace("CaptureStatus", { sessionId });
          }}
        />
      </BottomActionBar>
    </>
  );
}

const styles = StyleSheet.create({
  rowStatus: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
