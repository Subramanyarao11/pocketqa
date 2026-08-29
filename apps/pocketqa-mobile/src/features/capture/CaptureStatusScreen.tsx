import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, ConfirmSheet, DangerButton, GhostButton,
  PrimaryButton, StatusPill, TopBar,
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
  const [cancelOpen, setCancelOpen] = useState(false);

  const stepCount = activeProgress?.stepCount ?? 0;
  const state = activeProgress?.state ?? "recording";

  return (
    <>
      <TopBar
        title={state === "paused" ? "Paused" : "Recording"}
        subtitle={activeProgress?.packageName}
        right={<StatusPill label={state.toUpperCase()} tone={state === "recording" ? "red" : "amber"} />}
      />
      <AppScreen>
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
