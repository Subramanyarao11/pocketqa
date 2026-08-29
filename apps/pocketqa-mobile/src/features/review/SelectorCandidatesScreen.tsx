import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, GhostButton, InlineNotice, PrimaryButton,
  StatusPill, TopBar,
} from "@components";
import { PocketQaNative, type SelectorCandidate } from "@native";
import { useDraftEditorStore } from "@store";
import { colors, spacing, typography } from "@theme";

/** §7.9 — user picks a grounded, policy-filtered selector; executor never picks silently. */
export function SelectorCandidatesScreen({ navigation, route }: ScreenProps<"SelectorCandidates">) {
  const { draftId, stepId } = route.params;
  const [candidates, setCandidates] = useState<SelectorCandidate[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useDraftEditorStore((s) => s.load);

  useEffect(() => {
    let cancelled = false;
    PocketQaNative.listSelectorCandidates(draftId, stepId)
      .then((list) => {
        if (cancelled) return;
        setCandidates(list);
        const primaryIdx = list.findIndex((c) => c.isPrimary);
        setSelected(primaryIdx >= 0 ? primaryIdx : 0);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [draftId, stepId]);

  const promote = async () => {
    if (selected == null) return;
    try {
      await PocketQaNative.promoteFallbackSelector(draftId, stepId, selected);
      await load(draftId);
      navigation.goBack();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <>
      <TopBar
        title="Selector candidates"
        subtitle={`Step ${stepId}`}
        onBack={() => navigation.goBack()}
      />
      <AppScreen>
        {loading && (
          <Card><Text style={typography.bodyMuted}>Loading grounded candidates…</Text></Card>
        )}
        {!loading && candidates.length === 0 && (
          <InlineNotice
            title="No candidates available"
            detail="The compiler could not derive a selector for this step. Re-record from this action."
            tone="warn"
          />
        )}
        {error && <InlineNotice title="Couldn't update selector" detail={error} tone="danger" />}

        {candidates.map((c) => (
          <TouchableOpacity
            key={c.index}
            onPress={() => setSelected(c.index)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === c.index }}
            accessibilityLabel={`${c.strategy} candidate ${c.value}, ${(c.confidence * 100).toFixed(0)}% confidence`}
          >
            <Card tone={selected === c.index ? "callout" : "surface"}>
              <View style={styles.headline}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.pillRow}>
                    <StatusPill label={c.strategy} tone="cyan" />
                    <StatusPill
                      label={`${(c.confidence * 100).toFixed(0)}%`}
                      tone={c.confidence >= 0.85 ? "lime" : c.confidence >= 0.6 ? "cyan" : "amber"}
                    />
                    {c.isPrimary && <StatusPill label="Current primary" tone="violet" />}
                    {c.strategy === "coordinates" && <StatusPill label="Review-only" tone="red" />}
                  </View>
                  <Text style={styles.selectorValue}>{c.strategy} = {c.value}</Text>
                  <Text style={typography.bodyMuted}>{c.reason}</Text>
                </View>
                <View style={[styles.radio, { borderColor: selected === c.index ? colors.lime : colors.borderStrong }]}>
                  {selected === c.index && <View style={styles.radioDot} />}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Use this selector"
          disabled={selected == null || candidates[selected]?.isPrimary}
          onPress={promote}
        />
      </BottomActionBar>
    </>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  selectorValue: {
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.cyan,
    backgroundColor: "rgba(89,217,255,0.06)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: spacing.xs,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lime },
});
