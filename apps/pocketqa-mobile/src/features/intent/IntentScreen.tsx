import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, GhostButton, PrimaryButton, StatusPill, TopBar,
} from "@components";
import { PocketQaNative, type TargetApp } from "@native";
import { colors, radius, spacing, typography } from "@theme";

const DEFAULT_INTENT = "Verify SAVE20 remains applied after checkout fails and I tap retry.";

export function IntentScreen({ navigation }: ScreenProps<"Intent">) {
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [apps, setApps] = useState<TargetApp[]>([]);
  const [pkg, setPkg] = useState<string | null>(null);
  const [fixture, setFixture] = useState("coupon-retry");
  const [mode, setMode] = useState<"typed" | "voice">("typed");
  const [ack, setAck] = useState(false);

  useEffect(() => {
    PocketQaNative.listAllowlistedApps().then((list) => {
      setApps(list);
      if (list.length > 0) setPkg(list[0].packageName);
    });
  }, []);

  const invalid = intent.trim().length < 10 || intent.length > 500 || !pkg || !ack;

  return (
    <>
      <TopBar title="New test" subtitle="Say what must be true" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Text style={typography.eyebrow}>Intent · 10–500 characters</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity onPress={() => setMode("typed")} style={[styles.tab, mode === "typed" && styles.tabActive]}>
            <Text style={{ color: mode === "typed" ? "#0A0F14" : colors.text }}>Typed</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode("voice")} style={[styles.tab, mode === "voice" && styles.tabActive]}>
            <Text style={{ color: mode === "voice" ? "#0A0F14" : colors.text }}>Voice</Text>
          </TouchableOpacity>
          {mode === "voice" && <StatusPill label="Preview always shown" tone="cyan" />}
        </View>
        <TextInput
          style={styles.textarea}
          value={intent}
          onChangeText={setIntent}
          multiline
          placeholder="What behaviour must remain true?"
          placeholderTextColor={colors.textDim}
        />
        <Text style={typography.metadata}>{intent.length} / 500</Text>

        <Text style={[typography.eyebrow, { marginTop: spacing.md }]}>Target app · allowlist only</Text>
        {apps.map((app) => (
          <TouchableOpacity key={app.packageName} onPress={() => setPkg(app.packageName)}>
            <Card tone={pkg === app.packageName ? "callout" : "surface"}>
              <View style={styles.rowBetween}>
                <View>
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

        <Text style={[typography.eyebrow, { marginTop: spacing.md }]}>Fixture</Text>
        <Card>
          {[
            { id: "reset", label: "Reset (empty cart)" },
            { id: "coupon-retry", label: "Coupon retry (canonical)" },
            { id: "selector-drift", label: "Selector-drift build" },
          ].map((f) => (
            <TouchableOpacity key={f.id} onPress={() => setFixture(f.id)} style={styles.fixtureRow}>
              <View style={[styles.radio, { borderColor: fixture === f.id ? colors.lime : colors.borderStrong }]}>
                {fixture === f.id && <View style={styles.radioDot} />}
              </View>
              <Text style={typography.body}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </Card>

        <TouchableOpacity style={styles.consentRow} onPress={() => setAck((a) => !a)}>
          <View style={[styles.box, { borderColor: ack ? colors.lime : colors.borderStrong, backgroundColor: ack ? colors.lime : "transparent" }]}>
            {ack && <Text style={{ color: "#0A0F14", fontWeight: "900" }}>✓</Text>}
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

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.sm },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  tabActive: { backgroundColor: colors.lime },
  textarea: {
    minHeight: 96,
    padding: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1, borderColor: colors.borderStrong,
    color: colors.text,
    textAlignVertical: "top",
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lime },
  fixtureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  consentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
