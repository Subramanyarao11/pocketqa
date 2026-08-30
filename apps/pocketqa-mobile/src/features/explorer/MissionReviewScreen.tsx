import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { layout, makeStyles, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import {
  AppScreen,
  BottomActionBar,
  Card,
  GhostButton,
  PrimaryButton,
  Spacer,
  StatusPill,
  TopBar,
} from "@components";
import { PocketQaNative, type MissionSummary } from "@native";
import { type ScreenProps } from "@navigation";

export function MissionReviewScreen({ navigation, route }: ScreenProps<"MissionReview">) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [summary, setSummary] = useState<MissionSummary | null>(null);

  useEffect(() => {
    PocketQaNative.getMission(route.params.missionId).then(setSummary).catch(() => {});
  }, [route.params.missionId]);

  if (!summary) return <><TopBar title="Mission review" /><AppScreen><Text style={typography.bodyMuted}>Loading…</Text></AppScreen></>;

  const m = summary.mission;
  // Native policy enforcement does not depend on this presentation field. Some
  // persisted Android missions predate `hardStops`; keep review readable while
  // showing the same non-negotiable boundaries enforced by the policy engine.
  const hardStops = m.hardStops?.length ? m.hardStops : [
    "Payments and purchases",
    "Accounts and permissions",
    "Sensitive input and destructive actions",
    "System UI and cross-app navigation",
  ];
  return (
    <>
      <TopBar title="Mission review" subtitle="Approve as a whole" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <Text style={typography.eyebrow}>Objective</Text>
          <Text style={typography.body}>{m.goal}</Text>
        </Card>
        <Card>
          <Text style={typography.eyebrow}>Bounds</Text>
          <View style={styles.boundsRow}>
            <StatusPill label={`Actions ≤ ${m.maxActions}`} tone="cyan" />
            <StatusPill label={`Time ≤ ${m.maxDurationSeconds}s`} tone="cyan" />
            <StatusPill label={`Allowlist: ${m.packageAllowlist.join(",")}`} tone="lime" />
            <StatusPill label={`Tools: ${m.allowedTools.join(", ")}`} tone="dim" />
          </View>
        </Card>
        <Card tone="info">
          <Text style={typography.eyebrow}>Hard stops (always blocked)</Text>
          {hardStops.map((s) => (
            <Text key={s} style={typography.body}>• {s}</Text>
          ))}
        </Card>
        <Card tone="callout">
          <Text style={typography.eyebrow}>Ranker provenance</Text>
          <Text style={typography.body}>
            The model ranks only policy-filtered candidates. No free-form output is executed.
          </Text>
        </Card>
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
        <Spacer />
        <PrimaryButton
          label="Approve mission"
          onPress={async () => {
            await PocketQaNative.approveAndStartMission(m.id);
            navigation.replace("ExplorerMissionControl", { missionId: m.id });
          }}
        />
      </BottomActionBar>
    </>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  boundsRow: layout.rowWrap,
}));
