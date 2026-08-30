import { Text, View } from "react-native";
import { layout, makeStyles, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import {
  AppScreen,
  BottomActionBar,
  Card,
  GhostButton,
  PrimaryButton,
  Spacer,
  StatusPill,
  TopBar,
} from "@components";
import { PocketQaNative } from "@native";
import { type ScreenProps } from "@navigation";

export function CaptureReadyScreen({ navigation, route }: ScreenProps<"CaptureReady">) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  // Named after the app the operator chose. Both of these read "Demo Shop"
  // before, which was wrong on every other target and quietly implied PocketQA
  // only works against its own sample app.
  const target = route.params.targetName ?? "target app";
  return (
    <>
      <TopBar title="Ready to capture" subtitle="Review scope before switching apps" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card tone="callout">
          <Text style={typography.h2}>Before we switch to {target}</Text>
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
          <StatusPill label={`${target} reset`} tone="cyan" />
          <StatusPill label="Redaction on" tone="lime" />
        </View>
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
        <Spacer />
        <PrimaryButton
          label="Start demonstration"
          onPress={async () => {
            // The selected fixture is persisted with the intent. Native resolves
            // it here so this screen cannot silently replace the operator's
            // choice with a Demo Shop-specific hardcoded value.
            const { sessionId } = await PocketQaNative.startCapture({ intentId: route.params.intentId });
            navigation.replace("CaptureStatus", { sessionId });
          }}
        />
      </BottomActionBar>
    </>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  rowStatus: { ...layout.rowWrap, gap: spacing.sm },
}));
