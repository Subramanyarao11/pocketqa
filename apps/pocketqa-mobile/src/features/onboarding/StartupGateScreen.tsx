import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import {
  iconSize,
  layout,
  makeStyles,
  spacing,
  useAppTheme,
  useThemeStyles,
  type AppTheme,
} from "@theme";
import { IconTile } from "@components";
import { PocketQaNative } from "@native";
import { type ScreenProps } from "@navigation";

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
      <IconTile size="lg" tone="lime" bordered style={styles.mark}>
        <ShieldCheck color={colors.lime} size={iconSize.xxl} />
      </IconTile>
      <Text style={[typography.brand, styles.brand]}>PocketQA</Text>
      <Text style={typography.bodyMuted}>Preparing your local workspace…</Text>
      <ActivityIndicator color={colors.lime} style={styles.loader} />
    </View>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    ...layout.center,
  },
  mark: { marginBottom: spacing.lg },
  brand: { marginBottom: spacing.xs },
  loader: { marginTop: spacing.xl },
}));
