import { useEffect, useRef, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { ArrowRight, Check, Keyboard, Mic, Search } from "lucide-react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, GhostButton, InlineNotice, PrimaryButton,
  StatusPill, TopBar,
} from "@components";
import { PocketQaNative, type TargetApp } from "@native";
import { radius, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

// Prefilling a coupon-retry intent made every test start life describing Demo
// Shop, whatever app the operator picked — a Calculator capture arrived at review
// titled "Verify SAVE20 remains applied…". The intent is the one thing only the
// operator can supply, so start it empty and let the placeholder prompt for it.
const DEFAULT_INTENT = "";

/** Mock canned transcripts shown when the user "records". The real flow reaches
 *  Sarvam ASR; this preview keeps the confirm/edit contract identical. */
const VOICE_TRANSCRIPTS = [
  "Verify the SAVE20 coupon stays applied after payment fails and I tap retry.",
  "Check that the discount row still shows minus twenty percent after retry.",
  "Confirm the applied badge remains visible on the success screen.",
];

type VoiceState = "idle" | "recording" | "preview" | "confirmed";

export function IntentScreen({ navigation }: ScreenProps<"Intent">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [apps, setApps] = useState<TargetApp[]>([]);
  const [appQuery, setAppQuery] = useState("");
  const [pkg, setPkg] = useState<string | null>(null);
  const [fixture, setFixture] = useState("coupon-retry");
  const [mode, setMode] = useState<"typed" | "voice">("typed");
  const [ack, setAck] = useState(false);

  // Voice-flow state.
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [transcriptRedacted, setTranscriptRedacted] = useState(false);
  const [transcriptConfidence, setTranscriptConfidence] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const transcriptSeed = useRef(0);

  useEffect(() => {
    PocketQaNative.listAllowlistedApps().then((list) => {
      setApps(list);
      // Only preselect when there is genuinely no choice to make. This used to
      // take list[0] unconditionally, which was harmless while the allowlist had
      // one hardcoded entry — but the list is now every launchable app on the
      // device, so it silently armed a capture against whatever sorted first
      // (Albums, on this phone). Choosing the target is the consent; it has to
      // be deliberate.
      if (list.length === 1) setPkg(list[0].packageName);
    });
  }, []);

  const startRecording = () => {
    setVoiceState("recording");
    setVoiceError(null);
    setTranscript("");
    setTranscriptConfidence(null);
    // Simulate a Sarvam roundtrip on the next tick.
    setTimeout(() => {
      const seed = transcriptSeed.current++ % VOICE_TRANSCRIPTS.length;
      setTranscript(VOICE_TRANSCRIPTS[seed]);
      setVoiceState("preview");
    }, 900);
  };

  const confirmTranscript = async () => {
    // Route through the native façade so redaction runs before persistence.
    const stored = await PocketQaNative.createIntent({
      intent: transcript.trim(),
      packageName: pkg ?? "",
      fixture,
      disclosureAcknowledged: ack,
    }).catch(() => null);
    // For the mock, replay the transcript through the redactor and reflect
    // whatever the native side returns.
    if (stored) {
      const redactionResult = await PocketQaNative.submitVoiceTranscript(
        stored.intentId,
        transcript.trim()
      );
      setTranscript(redactionResult.transcript);
      setTranscriptRedacted(redactionResult.redacted);
      setTranscriptConfidence(redactionResult.confidence);
      setIntent(redactionResult.transcript);
      setVoiceState("confirmed");
      return stored.intentId;
    }
    setVoiceError("Voice pipeline unavailable — type your intent instead.");
    return null;
  };

  // The picker lists every launchable app on the device — around fifty on a
  // stock phone — which pushed the acknowledgement and Continue several screens
  // down and made the target genuinely hard to find. Filter, and cap how many
  // render at once so the rest of the form stays reachable.
  const APP_LIST_LIMIT = 6;
  const appQueryTrimmed = appQuery.trim().toLowerCase();
  const filteredApps = appQueryTrimmed
    ? apps.filter(
        (a) =>
          a.displayName.toLowerCase().includes(appQueryTrimmed) ||
          a.packageName.toLowerCase().includes(appQueryTrimmed)
      )
    : apps;
  // Keep the selected app visible even when a filter would exclude it, so the
  // choice never silently disappears from view.
  const visibleApps = (() => {
    const head = filteredApps.slice(0, APP_LIST_LIMIT);
    const selected = apps.find((a) => a.packageName === pkg);
    if (selected && !head.some((a) => a.packageName === pkg)) return [selected, ...head.slice(0, APP_LIST_LIMIT - 1)];
    return head;
  })();

  const FIXTURE_LABELS: Record<string, string> = {
    reset: "Reset (empty state)",
    "coupon-retry": "Coupon retry (canonical)",
    "selector-drift": "Selector-drift build",
  };
  const fixturesForSelectedApp = (apps.find((a) => a.packageName === pkg)?.fixtureIds ?? [])
    .map((id) => ({ id, label: FIXTURE_LABELS[id] ?? id }));

  const invalid = intent.trim().length < 10 || intent.length > 500 || !pkg || !ack;

  return (
    <>
      <TopBar title="New test" subtitle="Define intent and capture scope" onBack={() => navigation.goBack()} />
      <AppScreen>
        <View style={styles.sectionIntro}>
          <Text style={typography.eyebrow}>Test intent</Text>
          <Text style={typography.bodyMuted}>Describe the behaviour that must remain true in plain language.</Text>
        </View>
        <View style={styles.modeRow}>
          <TouchableOpacity
            onPress={() => setMode("typed")}
            style={[styles.tab, mode === "typed" && styles.tabActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === "typed" }}
          >
            <Keyboard color={mode === "typed" ? colors.onAccent : colors.textMuted} size={16} />
            <Text style={[styles.tabText, { color: mode === "typed" ? colors.onAccent : colors.text }]}>Typed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("voice")}
            style={[styles.tab, mode === "voice" && styles.tabActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === "voice" }}
          >
            <Mic color={mode === "voice" ? colors.onAccent : colors.textMuted} size={16} />
            <Text style={[styles.tabText, { color: mode === "voice" ? colors.onAccent : colors.text }]}>Voice</Text>
          </TouchableOpacity>
          {mode === "voice" && <StatusPill label="Preview always shown" tone="cyan" />}
        </View>

        {mode === "voice" && (
          <Card tone="info">
            <Text style={typography.eyebrow}>Voice intent</Text>
            {voiceState === "idle" && (
              <>
                <Text style={typography.body}>Tap to record. The transcript is shown before it becomes your intent — you always confirm it.</Text>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: spacing.sm }}>
                  <PrimaryButton label="Start recording" onPress={startRecording} />
                </View>
              </>
            )}
            {voiceState === "recording" && (
              <>
                <Text style={typography.body}>Listening…</Text>
                <Text style={typography.bodyMuted}>Speak the behaviour you want to verify.</Text>
              </>
            )}
            {(voiceState === "preview" || voiceState === "confirmed") && (
              <>
                <View style={styles.transcriptPills}>
                  {transcriptConfidence != null && (
                    <StatusPill
                      label={`ASR ${(transcriptConfidence * 100).toFixed(0)}%`}
                      tone={transcriptConfidence >= 0.8 ? "lime" : "amber"}
                    />
                  )}
                  {transcriptRedacted && <StatusPill label="Redacted" tone="amber" />}
                  <StatusPill
                    label={voiceState === "confirmed" ? "Confirmed" : "Awaiting confirmation"}
                    tone={voiceState === "confirmed" ? "lime" : "amber"}
                  />
                </View>
                <TextInput
                  style={styles.transcriptEdit}
                  value={transcript}
                  onChangeText={(t) => { setTranscript(t); if (voiceState === "confirmed") setVoiceState("preview"); }}
                  multiline
                  accessibilityLabel="Voice transcript editable preview"
                />
                <View style={styles.voiceRow}>
                  <GhostButton label="Re-record" onPress={startRecording} />
                  <View style={{ flex: 1 }} />
                  <PrimaryButton
                    label={voiceState === "confirmed" ? "Confirmed" : "Confirm transcript"}
                    onPress={confirmTranscript}
                    disabled={transcript.trim().length < 10 || voiceState === "confirmed" || !pkg || !ack}
                  />
                </View>
                {voiceError && <InlineNotice title="Voice failed" detail={voiceError} tone="danger" />}
              </>
            )}
          </Card>
        )}

        <TextInput
          style={styles.textarea}
          value={intent}
          onChangeText={setIntent}
          multiline
          placeholder="What behaviour must remain true?"
          placeholderTextColor={colors.textDim}
          accessibilityLabel="Intent"
        />
        <Text style={typography.metadata}>{intent.length} / 500</Text>

        <View style={styles.sectionIntro}>
          <Text style={typography.eyebrow}>Target app</Text>
          <Text style={typography.bodyMuted}>Only the app you choose is in capture scope.</Text>
        </View>
        <View style={styles.searchWrap}>
          <Search color={colors.textDim} size={18} />
          <TextInput
            style={styles.searchInput}
            value={appQuery}
            onChangeText={setAppQuery}
            placeholder={`Search ${apps.length} installed apps`}
            placeholderTextColor={colors.textDim}
            accessibilityLabel="Search target apps"
          />
        </View>
        {visibleApps.map((app) => (
          <TouchableOpacity
            key={app.packageName}
            onPress={() => {
              setPkg(app.packageName);
              if (!app.fixtureIds.includes(fixture)) {
                setFixture(app.fixtureIds[0] ?? "reset");
              }
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: pkg === app.packageName }}
          >
            <Card tone={pkg === app.packageName ? "callout" : "surface"}>
              <View style={styles.rowBetween}>
                <View style={styles.appCopy}>
                  <Text style={typography.h2}>{app.displayName}</Text>
                  <Text style={typography.metadata}>{app.packageName}</Text>
                </View>
                <View style={[styles.radio, { borderColor: pkg === app.packageName ? colors.lime : colors.borderStrong }]}>
                  {pkg === app.packageName && <View style={styles.radioDot} />}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
        {filteredApps.length > visibleApps.length && (
          <Text style={typography.metadata}>
            {`${filteredApps.length - visibleApps.length} more — refine the search to narrow this list.`}
          </Text>
        )}
        {filteredApps.length === 0 && (
          <Text style={typography.bodyMuted}>{`No installed app matches "${appQuery}".`}</Text>
        )}

        {/* Fixtures come from the selected app, not from a constant. The list was
            hardcoded to Demo Shop's three, so picking Calculator offered it
            "Reset (empty cart)" and "Coupon retry" — fixtures that do not exist
            for it. An app only has fixtures if it exposes a reset hook. */}
        {fixturesForSelectedApp.length > 0 && (
          <>
        <Text style={typography.eyebrow}>Starting state</Text>
        <Card>
          {fixturesForSelectedApp.map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFixture(f.id)}
              style={styles.fixtureRow}
              accessibilityRole="radio"
              accessibilityState={{ selected: fixture === f.id }}
            >
              <View style={[styles.radio, { borderColor: fixture === f.id ? colors.lime : colors.borderStrong }]}>
                {fixture === f.id && <View style={styles.radioDot} />}
              </View>
              <Text style={typography.body}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </Card>
          </>
        )}

        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setAck((a) => !a)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ack }}
        >
          <View style={[styles.box, { borderColor: ack ? colors.lime : colors.borderStrong, backgroundColor: ack ? colors.lime : "transparent" }]}>
            {ack && <Check color={colors.onAccent} size={16} strokeWidth={3} />}
          </View>
          <Text style={[typography.body, { flex: 1 }]}>
            I acknowledge that PocketQA will capture screen content in this app for the duration of the session.
          </Text>
        </TouchableOpacity>
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="Continue"
          icon={<ArrowRight color={colors.onAccent} size={17} />}
          disabled={invalid}
          onPress={async () => {
            if (!pkg) return;
            const { intentId } = await PocketQaNative.createIntent({
              intent: intent.trim(),
              packageName: pkg,
              fixture,
              disclosureAcknowledged: ack,
            });
            navigation.navigate("CaptureReady", { intentId });
          }}
        />
      </BottomActionBar>
    </>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  sectionIntro: { gap: spacing.xs, marginTop: spacing.sm },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center", marginBottom: spacing.sm },
  tab: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  textarea: {
    minHeight: 112,
    padding: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1, borderColor: colors.borderStrong,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
  },
  searchWrap: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  appCopy: { flex: 1, minWidth: 0 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lime },
  fixtureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  transcriptPills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  transcriptEdit: {
    minHeight: 72,
    padding: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1, borderColor: colors.borderStrong,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
  },
  voiceRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: spacing.sm },
});
