import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, GhostButton, PrimaryButton, StatusPill,
  TimelineRow, TopBar,
} from "@components";
import { PocketQaNative, type EvidenceStep, type ReplayRunSummary } from "@native";
import { colors, spacing, typography } from "@theme";

export function EvidenceScreen({ navigation, route }: ScreenProps<"Evidence">) {
  const [run, setRun] = useState<ReplayRunSummary | null>(null);
  const [timeline, setTimeline] = useState<EvidenceStep[]>([]);

  useEffect(() => {
    (async () => {
      setRun(await PocketQaNative.getRun(route.params.runId));
      setTimeline(await PocketQaNative.getEvidenceTimeline(route.params.runId));
    })().catch(() => {});
  }, [route.params.runId]);

  if (!run) {
    return <><TopBar title="Evidence" /><AppScreen><Text style={typography.bodyMuted}>Loading…</Text></AppScreen></>;
  }

  const pass = run.result.passed;

  return (
    <>
      <TopBar
        title="Evidence"
        subtitle="§7.11 · pass/fail facts, provenance, network"
        right={<StatusPill label={pass ? "PASS" : "FAIL"} tone={pass ? "lime" : "red"} />}
        onBack={() => navigation.replace("Home")}
      />
      <AppScreen>
        <Card tone={pass ? "callout" : "danger"}>
          <Text style={typography.eyebrow}>Result</Text>
          <Text style={typography.title}>{pass ? "Passed" : "Failed"}</Text>
          <Text style={typography.metadata}>
            {run.result.stepResults.length} step{run.result.stepResults.length === 1 ? "" : "s"}
            {" · "}
            {run.result.finishedAt - run.result.startedAt} ms
          </Text>
          {run.result.failure && (
            <Text style={[typography.body, { color: colors.red }]}>
              [{run.result.failure.category}] {run.result.failure.summary}
            </Text>
          )}
        </Card>

        <Card>
          <Text style={typography.eyebrow}>Provenance</Text>
          <View style={styles.pills}>
            <StatusPill label={run.test.compiledBy} tone="cyan" />
            <StatusPill label={run.result.offline ? "No network used" : "Online"} tone={run.result.offline ? "lime" : "amber"} />
            <StatusPill label={`schema ${run.test.schemaHash}`} tone="dim" />
          </View>
        </Card>

        <Text style={typography.eyebrow}>Timeline</Text>
        {timeline.map((t, i) => (
          <TimelineRow key={t.step.id} step={t.step} index={i} result={t.result} />
        ))}
      </AppScreen>
      <BottomActionBar>
        <GhostButton
          label="Share YAML"
          onPress={async () => {
            const art = await PocketQaNative.exportTest(run.test.id, run.test.version);
            await PocketQaNative.shareArtifact(art.uri, art.mimeType);
          }}
        />
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Share evidence"
          onPress={async () => {
            const art = await PocketQaNative.exportEvidence(run.runId);
            await PocketQaNative.shareArtifact(art.uri, art.mimeType);
          }}
        />
      </BottomActionBar>
    </>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
