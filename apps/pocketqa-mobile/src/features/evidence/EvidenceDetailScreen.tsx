import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { layout, makeStyles, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import { AppScreen, Card, EvidenceThumbnail, InlineNotice, StatusPill, TopBar } from "@components";
import { type UIState } from "@domain";
import { PocketQaNative } from "@native";
import { type ScreenProps } from "@navigation";

/** §7.11 — inspect the redacted UI tree, OCR, and bounds for a state referenced by evidence. */
export function EvidenceDetailScreen({ navigation, route }: ScreenProps<"EvidenceDetail">) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const { stateId } = route.params;
  const [state, setState] = useState<UIState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    PocketQaNative.getState(stateId).then((s) => {
      if (cancelled) return;
      setState(s);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [stateId]);

  const sensitiveCount = useMemo(
    () => state?.nodes.filter((n) => n.sensitive).length ?? 0,
    [state]
  );

  return (
    <>
      <TopBar
        title="State evidence"
        subtitle={state ? `${state.screenName} · ${state.packageName}` : stateId}
        onBack={() => navigation.goBack()}
      />
      <AppScreen>
        {loading && <Card><Text style={typography.bodyMuted}>Loading redacted state…</Text></Card>}
        {!loading && !state && (
          <InlineNotice
            title="State not available"
            detail="Native repo returned no snapshot for this ID. Older evidence may have been pruned."
            tone="warn"
          />
        )}
        {state && (
          <>
            <Card>
              <Text style={typography.eyebrow}>State summary</Text>
              <View style={styles.summary}>
                <EvidenceThumbnail
                  screenName={state.screenName}
                  uri={state.screenshotDataUri}
                  redactionCount={sensitiveCount}
                />
                <View style={styles.summaryCopy}>
                  <View style={styles.pillRow}>
                    <StatusPill label={state.screenName} tone="cyan" />
                    <StatusPill label={`${state.nodes.length} nodes`} tone="dim" />
                    <StatusPill label={`${state.ocrText.length} OCR lines`} tone="dim" />
                    {sensitiveCount > 0 && (
                      <StatusPill label={`${sensitiveCount} redacted`} tone="amber" />
                    )}
                  </View>
                  <Text style={typography.metadata}>
                    State ID {state.id}{" · "}captured {new Date(state.capturedAt).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            </Card>

            <Text style={typography.eyebrow}>Accessibility tree</Text>
            {state.nodes.map((n) => (
              <Card key={n.nodeId} tone={n.sensitive ? "warn" : "surface"}>
                <View style={styles.pillRow}>
                  <StatusPill label={n.role} tone="violet" />
                  {n.testId && <StatusPill label={`testId=${n.testId}`} tone="lime" />}
                  {n.resourceId && !n.testId && <StatusPill label={n.resourceId} tone="cyan" />}
                  {!n.enabled && <StatusPill label="disabled" tone="dim" />}
                  {!n.visible && <StatusPill label="off-screen" tone="dim" />}
                  {n.sensitive && <StatusPill label="redacted" tone="amber" />}
                </View>
                {!n.sensitive && n.text && <Text style={typography.body}>{n.text}</Text>}
                {n.sensitive && <Text style={typography.bodyMuted}>••• redacted •••</Text>}
                {!n.sensitive && n.contentDescription && (
                  <Text style={typography.bodyMuted}>a11y: {n.contentDescription}</Text>
                )}
                {n.bounds && (
                  <Text style={typography.metadata}>
                    bounds: {Math.round(n.bounds.x)},{Math.round(n.bounds.y)} · {Math.round(n.bounds.w)}×{Math.round(n.bounds.h)}
                  </Text>
                )}
              </Card>
            ))}

            {state.ocrText.length > 0 && (
              <>
                <Text style={typography.eyebrow}>OCR text</Text>
                <Card>
                  {state.ocrText.map((line, i) => (
                    <Text key={i} style={[typography.body, styles.ocrLine]}>{line}</Text>
                  ))}
                </Card>
              </>
            )}
          </>
        )}
      </AppScreen>
    </>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  summary: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  summaryCopy: { flex: 1, gap: spacing.xs },
  pillRow: { ...layout.rowWrap, marginBottom: spacing.xs },
  ocrLine: {
    paddingVertical: spacing.xxs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
}));
