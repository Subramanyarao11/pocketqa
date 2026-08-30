import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Clipboard, FileCode2, Share2 } from "lucide-react-native";
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
  GhostButton,
  InlineNotice,
  PrimaryButton,
  Spacer,
  StatusPill,
  TimelineRow,
  TopBar,
} from "@components";
import {
  PocketQaNative,
  type EvidenceStep,
  type FailureProposal,
  type ReplayRunSummary,
} from "@native";
import { type ScreenProps } from "@navigation";

export function EvidenceScreen({ navigation, route }: ScreenProps<"Evidence">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [run, setRun] = useState<ReplayRunSummary | null>(null);
  const [timeline, setTimeline] = useState<EvidenceStep[]>([]);
  const [proposal, setProposal] = useState<FailureProposal | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    (async () => {
      const [r, t, p] = await Promise.all([
        PocketQaNative.getRun(route.params.runId),
        PocketQaNative.getEvidenceTimeline(route.params.runId),
        PocketQaNative.getFailureProposal(route.params.runId),
      ]);
      setRun(r);
      setTimeline(t);
      setProposal(p);
    })().catch(() => {});
  }, [route.params.runId]);

  if (!run) {
    return <><TopBar title="Evidence" /><AppScreen><Text style={typography.bodyMuted}>Loading…</Text></AppScreen></>;
  }

  const pass = run.result.passed;
  const failureStateId = run.result.failure?.evidenceStateId;

  const applyProposal = async () => {
    if (!proposal?.action) return;
    if (proposal.action.kind === "promote-fallback" && proposal.stepId) {
      // Best-effort: pick the first fallback candidate for the failing step.
      const candidates = await PocketQaNative.listSelectorCandidates(run.test.id, proposal.stepId);
      const match = candidates.find(
        (c) => c.strategy === proposal.action!["strategy" as never] && c.value === proposal.action!["value" as never]
      ) ?? candidates.find((c) => !c.isPrimary);
      if (match) await PocketQaNative.promoteFallbackSelector(run.test.id, proposal.stepId, match.index);
    }
    navigation.replace("ReviewTest", { draftId: run.test.id });
  };

  return (
    <>
      <TopBar
        title="Evidence"
        subtitle="Result, provenance, and captured states"
        right={<StatusPill label={pass ? "PASS" : "FAIL"} tone={pass ? "lime" : "red"} />}
        onBack={() => navigation.replace("Home")}
      />
      <AppScreen>
        <Card tone={pass ? "callout" : "danger"}>
          <Text style={typography.eyebrow}>Result</Text>
          <Text style={typography.title}>{pass ? "Passed" : "Failed"}</Text>
          <Text style={typography.metadata}>
            {run.result.stepResults.length} step{run.result.stepResults.length === 1 ? "" : "s"}
            {" · "}
            {run.result.finishedAt - run.result.startedAt} ms
          </Text>
          {run.result.failure && (
            <Text style={[typography.body, { color: colors.red }]}>
              [{run.result.failure.category}] {run.result.failure.summary}
            </Text>
          )}
        </Card>

        {proposal && !pass && (
          <Card tone="warn">
            <View style={styles.detectiveHeader}>
              <Text style={typography.eyebrow}>Failure Detective</Text>
              <StatusPill label={proposal.category} tone="amber" />
            </View>
            <Text style={typography.body}>{proposal.suggestion}</Text>
            {proposal.action?.kind === "promote-fallback" && (
              <Text style={typography.bodyMuted}>
                Deterministic: {proposal.action.strategy} = {proposal.action.value}
              </Text>
            )}
            {proposal.aiSelectorRepair && (
              <View style={styles.aiRepair}>
                <Text style={typography.bodyMuted}>
                  AI alternative ({(proposal.aiSelectorRepair.confidence * 100).toFixed(0)}%):{" "}
                  {proposal.aiSelectorRepair.strategy} = {proposal.aiSelectorRepair.value}
                </Text>
                {proposal.aiSelectorRepair.provenance?.model && (
                  <Text style={typography.metadata}>
                    Proposed by {proposal.aiSelectorRepair.provenance.model}
                    {" · "}
                    v{proposal.aiSelectorRepair.provenance.promptVersion ?? "—"}
                  </Text>
                )}
              </View>
            )}
            <View style={styles.detectiveActions}>
              {failureStateId && (
                <GhostButton
                  label="Open failing state"
                  onPress={() => navigation.navigate("EvidenceDetail", { stateId: failureStateId })}
                />
              )}
              {proposal.aiSelectorRepair && (
                <PrimaryButton
                  label="Apply AI repair (bumps version)"
                  onPress={async () => {
                    try {
                      await PocketQaNative.applyAiSelectorRepair(
                        run.runId,
                        proposal.aiSelectorRepair!.stepId,
                      );
                      navigation.replace("Home");
                    } catch {
                      /* surface via error state in future; kept quiet for now */
                    }
                  }}
                />
              )}
              {!proposal.aiSelectorRepair && proposal.action && (
                <PrimaryButton label="Apply suggestion" onPress={applyProposal} />
              )}
            </View>
          </Card>
        )}

        {proposal?.aiExplanation && !pass && (
          <Card tone="info">
            <View style={styles.detectiveHeader}>
              <Text style={typography.eyebrow}>Why this failed</Text>
              {proposal.aiExplanationProvenance?.model && (
                <Text style={typography.metadata}>
                  Explained by {proposal.aiExplanationProvenance.model}
                </Text>
              )}
            </View>
            <Text style={typography.body}>{proposal.aiExplanation}</Text>
            <Text style={typography.metadata}>Explanation only — not applied</Text>
          </Card>
        )}

        {proposal?.aiFlake && (
          <Card>
            <View style={styles.detectiveHeader}>
              <Text style={typography.eyebrow}>Flake verdict</Text>
              <StatusPill
                label={proposal.aiFlake.verdict}
                tone={proposal.aiFlake.verdict === "flake" ? "amber" : "red"}
              />
            </View>
            {proposal.aiFlake.reason && (
              <Text style={typography.bodyMuted}>{proposal.aiFlake.reason}</Text>
            )}
            {proposal.aiFlake.provenance?.model && (
              <Text style={typography.metadata}>
                Classified by {proposal.aiFlake.provenance.model}
                {" — the failure above is not suppressed"}
              </Text>
            )}
          </Card>
        )}

        <Card>
          <Text style={typography.eyebrow}>Provenance</Text>
          <View style={styles.pills}>
            <StatusPill label={run.test.compiledBy} tone="cyan" />
            <StatusPill label={run.result.offline ? "No network used" : "Online"} tone={run.result.offline ? "lime" : "amber"} />
            <StatusPill label={`schema ${run.test.schemaHash}`} tone="dim" />
          </View>
        </Card>

        <Text style={typography.eyebrow}>Timeline</Text>
        {timeline.map((t, i) => (
          <TouchableOpacity
            key={t.step.id}
            onPress={() => t.afterState && navigation.navigate("EvidenceDetail", { stateId: t.afterState.id })}
            accessibilityRole="button"
            accessibilityLabel={`Inspect state after step ${i + 1}`}
          >
            <TimelineRow step={t.step} index={i} result={t.result} />
          </TouchableOpacity>
        ))}

        {copyState === "copied" && (
          <InlineNotice title="Copied" detail="Redacted diagnostics copied to clipboard." tone="info" />
        )}
      </AppScreen>
      <BottomActionBar>
        <GhostButton
          label="Share YAML"
          icon={<FileCode2 color={colors.text} size={iconSize.sm} />}
          onPress={async () => {
            const art = await PocketQaNative.exportTest(run.test.id, run.test.version);
            await PocketQaNative.shareArtifact(art.uri, art.mimeType);
          }}
        />
        <GhostButton
          label="Copy diagnostics"
          icon={<Clipboard color={colors.text} size={iconSize.sm} />}
          onPress={async () => {
            await PocketQaNative.copyRedactedDiagnostics(run.runId);
            setCopyState("copied");
            setTimeout(() => setCopyState("idle"), 2000);
          }}
        />
        <Spacer />
        <PrimaryButton
          label="Share evidence"
          icon={<Share2 color={colors.onAccent} size={iconSize.sm} />}
          onPress={async () => {
            const art = await PocketQaNative.exportEvidence(run.runId);
            await PocketQaNative.shareArtifact(art.uri, art.mimeType);
          }}
        />
      </BottomActionBar>
    </>
  );
}

const createStyles = makeStyles((theme: AppTheme) => ({
  pills: layout.rowWrap,
  detectiveHeader: layout.rowBetween,
  detectiveActions: { ...layout.rowWrap, gap: spacing.sm, marginTop: spacing.sm },
  aiRepair: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
}));
