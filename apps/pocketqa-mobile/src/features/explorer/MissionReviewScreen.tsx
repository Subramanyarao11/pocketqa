import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, GhostButton, PrimaryButton, StatusPill, TopBar,
} from "@components";
import { PocketQaNative, type MissionSummary } from "@native";
import { typography } from "@theme";

export function MissionReviewScreen({ navigation, route }: ScreenProps<"MissionReview">) {
  const [summary, setSummary] = useState<MissionSummary | null>(null);

  useEffect(() => {
    PocketQaNative.getMission(route.params.missionId).then(setSummary).catch(() => {});
  }, [route.params.missionId]);

  if (!summary) return <><TopBar title="Mission review" /><AppScreen><Text style={typography.bodyMuted}>Loading…</Text></AppScreen></>;

  const m = summary.mission;
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={`Actions ≤ ${m.maxActions}`} tone="cyan" />
            <StatusPill label={`Time ≤ ${m.maxDurationSeconds}s`} tone="cyan" />
            <StatusPill label={`Allowlist: ${m.packageAllowlist.join(",")}`} tone="lime" />
            <StatusPill label={`Tools: ${m.allowedTools.join(", ")}`} tone="dim" />
          </View>
        </Card>
        <Card tone="info">
          <Text style={typography.eyebrow}>Hard stops (always blocked)</Text>
          {m.hardStops.map((s) => (
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
        <View style={{ flex: 1 }} />
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
