import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Play } from "lucide-react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, Card, LogView, PersistentStopButton, PrimaryButton, ProgressBar,
  StatusPill, TopBar,
} from "@components";
import { PocketQaNative, type PocketQaEvent, type ReplayProgress } from "@native";
import { iconSize, useAppTheme } from "@theme";

export function ReplayMissionControlScreen({ navigation, route }: ScreenProps<"ReplayMissionControl">) {
  const { colors, typography } = useAppTheme();
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReplayProgress | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [testName, setTestName] = useState(route.params.testId);

  useEffect(() => {
    PocketQaNative.getTest(route.params.testId, route.params.version)
      .then((test) => setTestName(test.name || route.params.testId))
      .catch(() => setTestName(route.params.testId));
  }, [route.params.testId, route.params.version]);

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

  const completion = progress ? (progress.stepIndex + 1) / progress.totalSteps : 0;

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
          <Text style={typography.title}>{testName}</Text>
          <Text style={typography.metadata}>v{route.params.version}</Text>
          <ProgressBar value={completion} accessibilityLabel="Replay progress" />
          <Text style={typography.metadata}>
            {progress ? `Step ${progress.stepIndex + 1} of ${progress.totalSteps}` : "Ready"}
          </Text>
        </Card>

        <Card>
          <Text style={typography.eyebrow}>Live executor log</Text>
          <LogView lines={log} emptyLabel="Tap Replay locally to start." />
        </Card>

        <PrimaryButton
          label={running ? "Running…" : "Replay locally"}
          icon={<Play color={colors.onAccent} size={iconSize.md} fill={colors.onAccent} />}
          onPress={start}
          disabled={running}
          block
        />
      </AppScreen>
      {running && <PersistentStopButton onStop={() => runId && PocketQaNative.stopReplay(runId)} />}
    </>
  );
}
