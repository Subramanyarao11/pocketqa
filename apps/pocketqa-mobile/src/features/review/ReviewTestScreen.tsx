import { useEffect, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { CheckCircle2, Save, Trash2 } from "lucide-react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, DangerButton, GhostButton, InlineNotice,
  PrimaryButton, ReviewStepCard, StatusPill, TopBar,
} from "@components";
import { useDraftEditorStore } from "@store";
import { nextId, type Assertion, type AssertionKind } from "@domain";
import { radius, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import { PocketQaNative } from "@native";

const ASSERTION_KINDS: AssertionKind[] = ["textVisible", "textAbsent", "elementEnabled", "elementDisabled", "onScreen", "elementCount"];

export function ReviewTestScreen({ navigation, route }: ScreenProps<"ReviewTest">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const draft = useDraftEditorStore((s) => s.draft);
  const load = useDraftEditorStore((s) => s.load);
  const patch = useDraftEditorStore((s) => s.patch);
  const approve = useDraftEditorStore((s) => s.approve);
  const errors = useDraftEditorStore((s) => s.errors);

  const [newTarget, setNewTarget] = useState("");
  const [newKind, setNewKind] = useState<AssertionKind>("textVisible");

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
  const editStepInput = (id: string, input: string) => {
    patch({ steps: draft.steps.map((s) => s.id === id ? { ...s, input } : s) });
  };
  const editStepWait = (id: string, ms: number) => {
    patch({ steps: draft.steps.map((s) => s.id === id ? { ...s, waitMs: ms } : s) });
  };
  const addStepAssertion = (stepId: string, kind: AssertionKind, target: string) => {
    if (!target.trim()) return;
    const step = draft.steps.find((s) => s.id === stepId);
    if (!step) return;
    const a: Assertion = {
      id: nextId("assert"),
      kind,
      target: target.trim(),
      expected: target.trim(),
      sourceStateId: step.afterStateId,
      supported: true,
      reason: "Added during review.",
    };
    patch({
      steps: draft.steps.map((s) => s.id === stepId
        ? { ...s, assertions: [...s.assertions, a] }
        : s),
    });
  };
  const removeStepAssertion = (stepId: string, assertionId: string) => {
    patch({
      steps: draft.steps.map((s) => s.id === stepId
        ? { ...s, assertions: s.assertions.filter((a) => a.id !== assertionId) }
        : s),
    });
  };
  const openSelectorSheet = (stepId: string) => {
    navigation.navigate("SelectorCandidates", { draftId: draft.id, stepId });
  };

  const addFinalAssertion = () => {
    if (!newTarget.trim()) return;
    const lastStep = draft.steps[draft.steps.length - 1];
    const a: Assertion = {
      id: nextId("assert"),
      kind: newKind,
      target: newTarget.trim(),
      expected: newTarget.trim(),
      sourceStateId: lastStep?.afterStateId ?? "",
      supported: true,
      reason: "Added during review.",
    };
    patch({ finalAssertions: [...draft.finalAssertions, a] });
    setNewTarget("");
  };
  const removeFinalAssertion = (id: string) => {
    patch({ finalAssertions: draft.finalAssertions.filter((a) => a.id !== id) });
  };

  return (
    <>
      <TopBar title="Review draft" subtitle="Inspect every step before approval" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <TextInput
            style={styles.title}
            value={draft.name}
            onChangeText={(name) => patch({ name })}
            placeholder="Test name"
            placeholderTextColor={colors.textDim}
            accessibilityLabel="Test name"
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
            compiledBy={draft.compiledBy}
            onDelete={() => removeStep(s.id)}
            onMove={(dir) => moveStep(s.id, dir)}
            onEditInput={(v) => editStepInput(s.id, v)}
            onEditWait={(v) => editStepWait(s.id, v)}
            onOpenSelectors={() => openSelectorSheet(s.id)}
            onAddAssertion={(kind, target) => addStepAssertion(s.id, kind, target)}
            onRemoveAssertion={(aid) => removeStepAssertion(s.id, aid)}
          />
        ))}

        <Text style={typography.eyebrow}>Final assertions</Text>
        {draft.finalAssertions.length === 0 ? (
          <InlineNotice
            title="Add an end-state assertion"
            detail="PocketQA requires at least one assertion in the last observed state."
            tone="warn"
          />
        ) : (
          <Card>
            {draft.finalAssertions.map((a) => (
              <View key={a.id} style={styles.assertion}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body}>{a.kind} — "{a.target}"</Text>
                  <Text style={typography.bodyMuted}>{a.reason}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFinalAssertion(a.id)} accessibilityLabel="Remove assertion">
                  <Text style={{ color: colors.red, fontWeight: "600" }}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        <Card tone="info">
          <Text style={typography.eyebrow}>Add final assertion</Text>
          <View style={styles.kindRow}>
            {ASSERTION_KINDS.map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setNewKind(k)}
                accessibilityRole="radio"
                accessibilityState={{ selected: newKind === k }}
                style={[styles.kindChip, newKind === k && styles.kindChipActive]}
              >
                <Text style={{ color: newKind === k ? colors.onAccent : colors.text, fontSize: 12 }}>{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={newTarget}
            onChangeText={setNewTarget}
            placeholder="Target text or element ID"
            placeholderTextColor={colors.textDim}
            accessibilityLabel="Assertion target"
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <PrimaryButton label="Add assertion" onPress={addFinalAssertion} disabled={!newTarget.trim()} />
          </View>
        </Card>

        {errors.length > 0 && (
          <InlineNotice title="Blocking issues" detail={errors.join("\n")} tone="danger" />
        )}
      </AppScreen>
      <BottomActionBar>
        <DangerButton
          label="Discard"
          icon={<Trash2 color={colors.red} size={16} />}
          onPress={() => {
            PocketQaNative.deleteSession(draft.id).catch(() => {});
            navigation.replace("Home");
          }}
        />
        <GhostButton label="Save" icon={<Save color={colors.text} size={16} />} onPress={() => useDraftEditorStore.getState().save()} />
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Approve"
          icon={<CheckCircle2 color={colors.onAccent} size={17} />}
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

const createStyles = ({ colors }: AppTheme) => ({
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    borderRadius: radius.input,
    padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  assertion: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  input: {
    color: colors.text,
    borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.input,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  kindChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  kindChipActive: { backgroundColor: colors.lime, borderColor: colors.lime },
});
