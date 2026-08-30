import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { CheckCircle2, Save, Trash2 } from "lucide-react-native";
import {
  iconSize,
  layout,
  makeStyles,
  spacing,
  useAppTheme,
  useThemeStyles,
  type AppTheme,
} from "@theme";
import {
  AppScreen,
  BottomActionBar,
  Card,
  Chip,
  DangerButton,
  GhostButton,
  InlineNotice,
  LinkButton,
  PrimaryButton,
  ReviewStepCard,
  Spacer,
  StatusPill,
  TextField,
  TopBar,
} from "@components";
import { nextId, type Assertion, type AssertionKind } from "@domain";
import { PocketQaNative } from "@native";
import { type ScreenProps } from "@navigation";
import { useDraftEditorStore } from "@store";

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
          <TextField
            variant="title"
            value={draft.name}
            onChangeText={(name) => patch({ name })}
            placeholder="Test name"
            accessibilityLabel="Test name"
          />
          {draft.aiName?.provenance?.model && (
            <Text style={typography.metadata}>
              Named by {draft.aiName.provenance.model} — edit freely before approve
            </Text>
          )}
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
        {draft.aiFinalAssertionProvenance?.usedModel && draft.finalAssertions.some((a) => a.proposed) && (
          <InlineNotice
            title={`Proposed from your intent "${draft.intent}"`}
            detail={
              `Every proposal is a candidate the deterministic layer already produced — the model chose, ` +
              `it did not author. Uncheck any you don't want, or add your own below.`
            }
            tone="info"
          />
        )}
        {draft.finalAssertions.length === 0 ? (
          <InlineNotice
            title={
              draft.aiFinalAssertionProvenance
                ? `Couldn't propose assertions — add one below`
                : `Add an end-state assertion`
            }
            detail="PocketQA requires at least one assertion in the last observed state."
            tone="warn"
          />
        ) : (
          <Card>
            {draft.finalAssertions.map((a) => (
              <View key={a.id} style={styles.assertion}>
                <View style={layout.fill}>
                  <Text style={typography.body}>
                    {a.kind} — "{a.target}"
                    {a.proposed && (
                      <Text style={typography.metadata}>
                        {"  proposed"}
                        {typeof a.aiConfidence === "number" ? ` · ${a.aiConfidence.toFixed(2)}` : ""}
                      </Text>
                    )}
                  </Text>
                  <Text style={typography.bodyMuted}>{a.reason}</Text>
                </View>
                <LinkButton
                  label="Remove"
                  tone="red"
                  onPress={() => removeFinalAssertion(a.id)}
                  accessibilityLabel="Remove assertion"
                />
              </View>
            ))}
          </Card>
        )}

        <Card tone="info">
          <Text style={typography.eyebrow}>Add final assertion</Text>
          <View style={styles.kindRow}>
            {ASSERTION_KINDS.map((k) => (
              <Chip key={k} label={k} selected={newKind === k} onPress={() => setNewKind(k)} />
            ))}
          </View>
          <TextField
            value={newTarget}
            onChangeText={setNewTarget}
            placeholder="Target text or element ID"
            accessibilityLabel="Assertion target"
            style={styles.field}
          />
          <View style={layout.row}>
            <Spacer />
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
          icon={<Trash2 color={colors.red} size={iconSize.sm} />}
          onPress={() => {
            PocketQaNative.deleteSession(draft.id).catch(() => {});
            navigation.replace("Home");
          }}
        />
        <GhostButton label="Save" icon={<Save color={colors.text} size={iconSize.sm} />} onPress={() => useDraftEditorStore.getState().save()} />
        <Spacer />
        <PrimaryButton
          label="Approve"
          icon={<CheckCircle2 color={colors.onAccent} size={iconSize.md} />}
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

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  pillRow: { ...layout.rowWrap, marginTop: spacing.sm },
  assertion: {
    ...layout.row,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  field: { marginVertical: spacing.sm },
  kindRow: layout.rowWrap,
}));
