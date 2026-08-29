import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Play } from "lucide-react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, Card, PersistentStopButton, PrimaryButton, StatusPill, TopBar,
} from "@components";
import { PocketQaNative, type PocketQaEvent, type ReplayProgress } from "@native";
import { spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

export function ReplayMissionControlScreen({ navigation, route }: ScreenProps<"ReplayMissionControl">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReplayProgress | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const off = PocketQaNative.addListener((e: PocketQaEvent) => {
      if (e.type === "REPLAY_PROGRESS" && (runId ? e.payload.runId === runId : true)) {
        setProgress(e.payload);
        setLog((l) => [...l, `[${e.payload.stepIndex + 1}] ${e.payload.currentLabel}`]);
      }
      if (e.type === "REPLAY_FINISHED" && (runId ? e.payload.runId === runId : true)) {
        setRunning(false);
        navigation.replace("Evidence", { runId: e.payload.runId });
      }
    });
    return off;
  }, [navigation, runId]);

  const start = async () => {
    setLog([]);
    setProgress(null);
    setRunning(true);
    const res = await PocketQaNative.startReplay(route.params.testId, route.params.version);
    setRunId(res.runId);
  };

  const pct = progress ? Math.round((progress.stepIndex + 1) / progress.totalSteps * 100) : 0;

  return (
    <>
      <TopBar
        title="Replay"
        subtitle="Deterministic execution"
        right={<StatusPill label="Local execution" tone="lime" />}
        onBack={() => navigation.goBack()}
      />
      <AppScreen>
        <Card tone="callout">
          <Text style={typography.eyebrow}>Approved test</Text>
          <Text style={typography.title}>{route.params.testId}</Text>
          <Text style={typography.metadata}>v{route.params.version}</Text>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={typography.metadata}>
            {progress ? `Step ${progress.stepIndex + 1} of ${progress.totalSteps}` : "Ready"}
          </Text>
        </Card>

        <Card>
          <Text style={typography.eyebrow}>Live executor log</Text>
          {log.length === 0 && <Text style={typography.bodyMuted}>Tap ▶ Replay locally to start.</Text>}
          {log.map((line, i) => (
            <Text key={i} style={styles.logLine}>{line}</Text>
          ))}
        </Card>

        <PrimaryButton
          label={running ? "Running…" : "Replay locally"}
          icon={<Play color={colors.onAccent} size={17} fill={colors.onAccent} />}
          onPress={start}
          disabled={running}
          block
        />
      </AppScreen>
      {running && <PersistentStopButton onStop={() => runId && PocketQaNative.stopReplay(runId)} />}
    </>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  bar: {
    height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, marginTop: spacing.sm, overflow: "hidden",
  },
  fill: { height: 6, backgroundColor: colors.lime },
  logLine: { fontFamily: "monospace", fontSize: 12, lineHeight: 19, color: colors.textMuted, paddingVertical: 2 },
});
