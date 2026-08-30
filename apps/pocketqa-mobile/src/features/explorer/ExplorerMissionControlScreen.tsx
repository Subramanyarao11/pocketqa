import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { layout, makeStyles, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import {
  AppScreen,
  Card,
  GhostButton,
  LogView,
  PersistentStopButton,
  Spacer,
  StatusPill,
  TopBar,
} from "@components";
import {
  PocketQaNative,
  type MissionProgress,
  type MissionSummary,
  type PocketQaEvent,
} from "@native";
import { type ScreenProps } from "@navigation";

export function ExplorerMissionControlScreen({ navigation, route }: ScreenProps<"ExplorerMissionControl">) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [progress, setProgress] = useState<MissionProgress | null>(null);
  const [summary, setSummary] = useState<MissionSummary | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    PocketQaNative.getMission(route.params.missionId).then(setSummary).catch(() => {});
    const off = PocketQaNative.addListener((e: PocketQaEvent) => {
      if (e.type === "MISSION_PROGRESS" && e.payload.missionId === route.params.missionId) {
        setProgress(e.payload);
        if (e.payload.latestEventLabel) setLog((l) => [...l, e.payload.latestEventLabel!]);
      }
      if (e.type === "MISSION_FINISHED" && e.payload.mission.id === route.params.missionId) {
        setSummary(e.payload);
      }
    });
    return off;
  }, [route.params.missionId]);

  return (
    <>
      <TopBar
        title="Explorer"
        subtitle="Bounded mission"
        right={<StatusPill label={summary?.proposal ? "Proposal ready" : "Running"} tone={summary?.proposal ? "lime" : "cyan"} />}
        onBack={() => navigation.replace("Home")}
      />
      <AppScreen>
        <Card tone="callout">
          <Text style={typography.eyebrow}>Approved goal</Text>
          <Text style={typography.body}>{summary?.mission.goal ?? "…"}</Text>
          <View style={styles.rowPills}>
            <StatusPill label={`Actions ${progress?.actionsTaken ?? 0}/${progress?.actionsMax ?? summary?.mission.maxActions ?? 0}`} tone="cyan" />
            <StatusPill label={`Time ${progress?.secondsRemaining ?? summary?.mission.maxDurationSeconds ?? 0}s left`} tone="cyan" />
          </View>
        </Card>

        <Card>
          <Text style={typography.eyebrow}>Mission trace</Text>
          <LogView lines={log} emptyLabel="Waiting for events…" />
        </Card>

        {summary?.proposal && (
          <Card tone="callout">
            <StatusPill label="Proposal only" tone="violet" />
            <Text style={typography.h2}>{summary.proposal.summary}</Text>
            {summary.proposal.candidateAssertions.map((a) => (
              <Text key={a.id} style={typography.bodyMuted}>• textVisible "{a.target}" — {a.reason}</Text>
            ))}
            <View style={styles.rowActions}>
              <GhostButton label="Discard" onPress={() => navigation.replace("Home")} />
              <Spacer />
              <GhostButton
                label="Open in review"
                onPress={() => navigation.navigate("MissionReview", { missionId: summary.mission.id })}
              />
            </View>
          </Card>
        )}
      </AppScreen>
      <PersistentStopButton onStop={() => PocketQaNative.stopMission(route.params.missionId)} />
    </>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  rowPills: { ...layout.rowWrap, marginTop: spacing.sm },
  rowActions: { ...layout.row, gap: spacing.sm, marginTop: spacing.md },
}));
