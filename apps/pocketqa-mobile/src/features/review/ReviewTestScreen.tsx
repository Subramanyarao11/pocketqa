import { useEffect } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, DangerButton, InlineNotice, PrimaryButton,
  ReviewStepCard, StatusPill, TopBar,
} from "@components";
import { useDraftEditorStore } from "@store";
import { colors, radius, spacing, typography } from "@theme";
import { PocketQaNative } from "@native";

export function ReviewTestScreen({ navigation, route }: ScreenProps<"ReviewTest">) {
  const draft = useDraftEditorStore((s) => s.draft);
  const load = useDraftEditorStore((s) => s.load);
  const patch = useDraftEditorStore((s) => s.patch);
  const approve = useDraftEditorStore((s) => s.approve);
  const errors = useDraftEditorStore((s) => s.errors);

  useEffect(() => { load(route.params.draftId); }, [load, route.params.draftId]);

  if (!draft) {
    return <><TopBar title="Review" /><AppScreen><Text style={typography.bodyMuted}>Loading draft…</Text></AppScreen></>;
  }

  const removeStep = (id: string) => {
    patch({ steps: draft.steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })) });
  };
  const moveStep = (id: string, dir: -1 | 1) => {
    const idx = draft.steps.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (target < 0 || target >= draft.steps.length) return;
    const next = draft.steps.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    patch({ steps: next.map((s, o) => ({ ...s, order: o })) });
  };

  return (
    <>
      <TopBar title="Review draft" subtitle="Review before action" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <TextInput
            style={styles.title}
            value={draft.name}
            onChangeText={(name) => patch({ name })}
            placeholder="Test name"
            placeholderTextColor={colors.textDim}
          />
          <Text style={typography.bodyMuted}>{draft.intent}</Text>
          <View style={styles.pillRow}>
            <StatusPill label={`Compiled by ${draft.compiledBy}`} tone="cyan" />
            <StatusPill label={`${draft.steps.length} steps`} tone="dim" />
            <StatusPill label={`${draft.finalAssertions.length} final assertions`} tone="dim" />
            {draft.offlineOnly && <StatusPill label="Offline compile" tone="lime" />}
          </View>
        </Card>

        <Text style={typography.eyebrow}>Steps</Text>
        {draft.steps.map((s, i) => (
          <ReviewStepCard
            key={s.id}
            step={s}
            index={i}
            onDelete={() => removeStep(s.id)}
            onMove={(dir) => moveStep(s.id, dir)}
          />
        ))}

        <Text style={typography.eyebrow}>Final assertions</Text>
        {draft.finalAssertions.length === 0 ? (
          <InlineNotice title="Add an end-state assertion" detail="PocketQA requires at least one assertion in the last observed state." tone="warn" />
        ) : (
          <Card>
            {draft.finalAssertions.map((a) => (
              <View key={a.id} style={styles.assertion}>
                <Text style={typography.body}>{a.kind} — "{a.target}"</Text>
                <Text style={typography.bodyMuted}>{a.reason}</Text>
              </View>
            ))}
          </Card>
        )}

        {errors.length > 0 && (
          <InlineNotice
            title="Blocking issues"
            detail={errors.join("\n")}
            tone="danger"
          />
        )}
      </AppScreen>
      <BottomActionBar>
        <DangerButton label="Discard" onPress={() => {
          PocketQaNative.deleteSession(draft.id).catch(() => {});
          navigation.replace("Home");
        }} />
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Approve"
          onPress={async () => {
            try {
              await approve();
              navigation.replace("ReplayMissionControl", { testId: draft.id, version: 1 });
            } catch {
              // errors surfaced in store
            }
          }}
        />
      </BottomActionBar>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    borderRadius: radius.input,
    padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  assertion: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
