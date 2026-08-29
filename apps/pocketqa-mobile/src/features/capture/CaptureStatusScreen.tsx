import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, ConfirmSheet, DangerButton, GhostButton,
  InlineNotice, PrimaryButton, StatusPill, TopBar,
} from "@components";
import { PocketQaNative } from "@native";
import { useActiveOperationStore } from "@store";
import { spacing, typography } from "@theme";

const CANONICAL_STEPS: Array<{ action: "tap" | "typeText"; label: string; input?: string }> = [
  { action: "tap", label: "Open sneakers product" },
  { action: "tap", label: "Add to cart" },
  { action: "tap", label: "Open cart" },
  { action: "typeText", label: "Type coupon SAVE20", input: "SAVE20" },
  { action: "tap", label: "Apply coupon" },
  { action: "tap", label: "Continue to checkout" },
  { action: "tap", label: "Retry checkout" },
];

/** Demo-only tail — shown so reviewers see the policy engine kick in on cue. */
const HARD_STOP_DEMO: Array<{ action: "tap" | "typeText"; label: string }> = [
  { action: "tap", label: "Place order" },
  { action: "tap", label: "Grant permission" },
  { action: "typeText", label: "Type OTP" },
];

/**
 * On a real device the user is in the target app while capture runs.  When they
 * return to PocketQA this screen appears and lets them Pause/Resume/Finish/Cancel.
 * The prototype exposes a step-by-step scripted trace via the mock harness so
 * the flow can be demonstrated without the target APK.
 */
export function CaptureStatusScreen({ navigation, route }: ScreenProps<"CaptureStatus">) {
  const activeProgress = useActiveOperationStore((s) =>
    s.active?.kind === "CAPTURE" ? s.active.progress : undefined
  );
  const hardStop = useActiveOperationStore((s) => s.lastHardStop);
  const dismissHardStop = useActiveOperationStore((s) => s.dismissHardStop);
  const [cancelOpen, setCancelOpen] = useState(false);

  const stepCount = activeProgress?.stepCount ?? 0;
  const state = activeProgress?.state ?? "recording";

  // Session ended by a hard stop — auto-return home after the user acknowledges.
  useEffect(() => {
    if (hardStop && hardStop.operationId === route.params.sessionId) {
      const t = setTimeout(() => {
        dismissHardStop();
        navigation.replace("Home");
      }, 3200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [hardStop, route.params.sessionId, dismissHardStop, navigation]);

  return (
    <>
      <TopBar
        title={state === "paused" ? "Paused" : "Recording"}
        subtitle={activeProgress?.packageName}
        right={<StatusPill label={state.toUpperCase()} tone={state === "recording" ? "red" : "amber"} />}
      />
      <AppScreen>
        {hardStop && hardStop.operationId === route.params.sessionId && (
          <InlineNotice
            title={`Hard stop · ${hardStop.category}`}
            detail={`[${hardStop.code}] ${hardStop.message}`}
            tone="danger"
          />
        )}
        <Card>
          <Text style={typography.eyebrow}>Session state</Text>
          <Text style={typography.title}>{state === "paused" ? "Paused" : state === "finalising" ? "Finalising" : "Recording"}</Text>
          <Text style={typography.metadata}>
            {stepCount} step{stepCount === 1 ? "" : "s"} captured · {activeProgress?.elapsedMs ?? 0} ms
          </Text>
          {activeProgress?.lastActionLabel && (
            <Text style={typography.bodyMuted}>Last: {activeProgress.lastActionLabel}</Text>
          )}
          {activeProgress?.partialEvidenceWarning && (
            <Text style={[typography.bodyMuted, { color: "#F2B84B" }]}>
              {activeProgress.partialEvidenceWarning}
            </Text>
          )}
        </Card>

        <Card tone="info">
          <Text style={typography.eyebrow}>Canonical scenario</Text>
          <Text style={typography.body}>Run the scripted trace through the Demo Shop (mock harness).</Text>
          {CANONICAL_STEPS.map((s, i) => (
            <View key={i} style={styles.row}>
              <StatusPill label={i < stepCount ? "✓" : String(i + 1)} tone={i < stepCount ? "lime" : "dim"} />
              <Text style={[typography.body, { flex: 1 }]}>{s.label}</Text>
              <GhostButton
                label={i < stepCount ? "Done" : "Send"}
                onPress={() => PocketQaNative.simulateCaptureEvent(route.params.sessionId, s)}
              />
            </View>
          ))}
        </Card>

        <Card tone="warn">
          <Text style={typography.eyebrow}>Policy demo</Text>
          <Text style={typography.bodyMuted}>Tapping any of these triggers a hard stop.</Text>
          <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
            {HARD_STOP_DEMO.map((s, i) => (
              <View key={i} style={styles.row}>
                <StatusPill label="Blocked" tone="red" />
                <Text style={[typography.body, { flex: 1 }]}>{s.label}</Text>
                <GhostButton
                  label="Try"
                  onPress={() => PocketQaNative.simulateCaptureEvent(route.params.sessionId, s)}
                />
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={typography.eyebrow}>Controls</Text>
          <View style={styles.controlsRow}>
            {state === "paused"
              ? <GhostButton label="Resume" onPress={() => PocketQaNative.resumeCapture(route.params.sessionId)} />
              : <GhostButton label="Pause" onPress={() => PocketQaNative.pauseCapture(route.params.sessionId)} />}
            <DangerButton label="Cancel" onPress={() => setCancelOpen(true)} />
          </View>
        </Card>
      </AppScreen>
      <BottomActionBar>
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Finish"
          disabled={stepCount < 2}
          onPress={async () => {
            const { compileJobId } = await PocketQaNative.finishCapture(route.params.sessionId);
            navigation.replace("CompileProgress", { compileJobId });
          }}
        />
      </BottomActionBar>

      <ConfirmSheet
        visible={cancelOpen}
        title="Cancel this session?"
        detail="All recorded steps and captured state will be deleted."
        confirmLabel="Cancel and delete"
        variant="danger"
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          PocketQaNative.cancelCapture(route.params.sessionId, true);
          navigation.replace("Home");
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  controlsRow: { flexDirection: "row", gap: spacing.sm },
});
