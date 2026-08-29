import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { ScreenProps } from "@navigation";
import { PocketQaNative } from "@native";
import { colors, spacing, typography } from "@theme";

export function StartupGateScreen({ navigation }: ScreenProps<"StartupGate">) {
  useEffect(() => {
    (async () => {
      const startup = await PocketQaNative.getStartupState();
      if (startup.activeOperation?.kind === "CAPTURE") {
        navigation.replace("CaptureStatus", { sessionId: startup.activeOperation.id });
        return;
      }
      if (startup.activeOperation?.kind === "COMPILE") {
        navigation.replace("CompileProgress", { compileJobId: startup.activeOperation.id });
        return;
      }
      if (startup.activeOperation?.kind === "REPLAY") {
        // Real build would round-trip via getRun to get the testId + version.
        navigation.replace("Home");
        return;
      }
      if (startup.activeOperation?.kind === "MISSION") {
        navigation.replace("ExplorerMissionControl", { missionId: startup.activeOperation.id });
        return;
      }
      if (!startup.onboardingComplete) {
        navigation.replace("Welcome");
        return;
      }
      navigation.replace("Home");
    })().catch(() => navigation.replace("Welcome"));
  }, [navigation]);

  return (
    <View style={styles.root}>
      <Text style={typography.eyebrow}>PocketQA</Text>
      <Text style={[typography.title, { marginTop: spacing.sm }]}>Show it once. Ship the test.</Text>
      <ActivityIndicator color={colors.lime} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.xl },
});
