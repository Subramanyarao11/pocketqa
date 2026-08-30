import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { layout, makeStyles, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import {
  AppScreen,
  BottomActionBar,
  Card,
  GhostButton,
  InlineNotice,
  ProgressStageList,
  Spacer,
  StatusPill,
  TopBar,
} from "@components";
import { PocketQaNative, type CompileProgress, type PocketQaEvent } from "@native";
import { type ScreenProps } from "@navigation";

const INITIAL_STAGES: CompileProgress["stages"] = [
  { id: "finalising", label: "Finalising evidence", state: "pending" },
  { id: "redacting", label: "Redacting sensitive content", state: "pending" },
  { id: "selectors", label: "Building selectors", state: "pending" },
  { id: "assertions", label: "Deriving assertions", state: "pending" },
  { id: "enhance", label: "Enhancing locally when supported", state: "pending" },
  { id: "validating", label: "Validating draft", state: "pending" },
];

export function CompileProgressScreen({ navigation, route }: ScreenProps<"CompileProgress">) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [job, setJob] = useState<CompileProgress>({
    jobId: route.params.compileJobId,
    engine: "deterministic-local",
    stages: INITIAL_STAGES,
    finished: false,
  });

  useEffect(() => {
    const off = PocketQaNative.addListener((e: PocketQaEvent) => {
      if (e.type === "COMPILE_PROGRESS" && e.payload.jobId === route.params.compileJobId) {
        setJob(e.payload);
      }
      if (e.type === "COMPILE_FINISHED" && e.payload.jobId === route.params.compileJobId) {
        navigation.replace("ReviewTest", { draftId: e.payload.draftId });
      }
    });
    return off;
  }, [navigation, route.params.compileJobId]);

  return (
    <>
      <TopBar title="Building your test" subtitle="Deterministic local pipeline" />
      <AppScreen>
        <Card>
          <View style={styles.engineRow}>
            <Text style={typography.eyebrow}>Active engine</Text>
            <StatusPill
              label={engineLabel(job.engine)}
              tone={job.engine === "deterministic-local" ? "lime" : job.engine === "on-device-ai" ? "cyan" : "violet"}
            />
          </View>
          <Text style={typography.body}>
            Only validated schemas and deterministic code drive execution. Invalid model output is
            rejected and retried once; a second failure falls back deterministically.
          </Text>
        </Card>
        <ProgressStageList stages={job.stages.length ? job.stages : INITIAL_STAGES} />
        {job.error && (
          <InlineNotice
            title="Compilation failed"
            detail={job.error.message}
            tone="danger"
          />
        )}
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Return" onPress={() => navigation.replace("Home")} />
        <Spacer />
      </BottomActionBar>
    </>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  engineRow: layout.rowBetween,
}));

function engineLabel(engine: CompileProgress["engine"]): string {
  switch (engine) {
    case "deterministic-local": return "Deterministic Local";
    case "on-device-ai": return "On-device AI";
    case "connected-assist": return "Connected Assist";
  }
}
