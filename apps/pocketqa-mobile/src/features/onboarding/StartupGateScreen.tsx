import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import type { ScreenProps } from "@navigation";
import { PocketQaNative } from "@native";
import { spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

export function StartupGateScreen({ navigation }: ScreenProps<"StartupGate">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
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
      <View style={styles.mark}><ShieldCheck color={colors.lime} size={28} /></View>
      <Text style={styles.brand}>PocketQA</Text>
      <Text style={typography.bodyMuted}>Preparing your local workspace…</Text>
      <ActivityIndicator color={colors.lime} style={styles.loader} />
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  root: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  brand: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "700", marginBottom: spacing.xs },
  loader: { marginTop: spacing.xl },
});
