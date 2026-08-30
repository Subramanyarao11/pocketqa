import { useState } from "react";
import { Text, View } from "react-native";
import { Info, Trash2 } from "lucide-react-native";
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
  ConfirmSheet,
  DangerButton,
  GhostButton,
  Spacer,
  StatusPill,
  Toggle,
  TopBar,
} from "@components";
import { PocketQaNative } from "@native";
import { type ScreenProps } from "@navigation";
import { useReadinessStore } from "@store";

export function SettingsScreen({ navigation }: ScreenProps<"Settings">) {
  const { colors, typography, isDark } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const readiness = useReadinessStore((s) => s.readiness);
  const refresh = useReadinessStore((s) => s.refresh);
  const [wipeOpen, setWipeOpen] = useState(false);

  const setOffline = async (v: boolean) => {
    await PocketQaNative.setOfflineMode(v);
    await refresh();
  };

  return (
    <>
      <TopBar title="Settings" subtitle="Capture, providers, and privacy" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Text style={typography.eyebrow}>Appearance</Text>
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={typography.h2}>System theme</Text>
              <Text style={typography.bodyMuted}>PocketQA follows your device appearance automatically.</Text>
            </View>
            <StatusPill label={isDark ? "Dark" : "Light"} tone="dim" />
          </View>
        </Card>

        <Text style={typography.eyebrow}>Capture</Text>
        <Card>
          <SettingRow
            label="Airplane mode"
            hint="Core loop remains available: capture, compile, review, replay, export."
            value={!!readiness?.offlineMode}
            onChange={setOffline}
          />
        </Card>

        <Text style={typography.eyebrow}>Local AI</Text>
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={typography.h2}>On-device Prompt engine</Text>
              <Text style={typography.bodyMuted}>
                Gemini Nano / ML Kit Prompt API. Deterministic local compiler is the guaranteed fallback.
              </Text>
            </View>
            <StatusPill
              label={readiness?.onDeviceModel === "ready" ? "Ready" : "Unavailable"}
              tone={readiness?.onDeviceModel === "ready" ? "lime" : "amber"}
            />
          </View>
        </Card>

        <Text style={typography.eyebrow}>Connected providers</Text>
        <Card>
          <ProviderRow
            label="Sarvam voice"
            hint="Only microphone audio from the intent screen. No screenshots or trees are sent."
            masked={readiness?.connected.sarvam.maskedKey}
            configured={!!readiness?.connected.sarvam.configured}
            onSet={async () => {
              await PocketQaNative.saveProviderCredential({ provider: "sarvam", key: "demo-key-1234" });
              refresh();
            }}
            onClear={async () => {
              await PocketQaNative.deleteProviderCredential("sarvam");
              refresh();
            }}
          />
          <ProviderRow
            label="OpenAI review adapter"
            hint="Optional connected review of one difficult state. Redacted preview required."
            masked={readiness?.connected.openai.maskedKey}
            configured={!!readiness?.connected.openai.configured}
            onSet={async () => {
              await PocketQaNative.saveProviderCredential({ provider: "openai", key: "demo-key-5678" });
              refresh();
            }}
            onClear={async () => {
              await PocketQaNative.deleteProviderCredential("openai");
              refresh();
            }}
          />
        </Card>

        <Text style={typography.eyebrow}>Danger zone</Text>
        <Card tone="danger">
          <Text style={typography.h2}>Delete all local data</Text>
          <Text style={typography.bodyMuted}>
            Removes sessions, tests, evidence, and consent record from this device.
          </Text>
          <DangerButton
            label="Delete all data"
            icon={<Trash2 color={colors.red} size={iconSize.sm} />}
            onPress={() => setWipeOpen(true)}
            block
          />
        </Card>

        <Text style={typography.bodyMuted}>PocketQA · Private mobile QA workspace · Tech Phantoms</Text>
      </AppScreen>
      <BottomActionBar>
        <GhostButton
          label="About & limits"
          icon={<Info color={colors.text} size={iconSize.sm} />}
          onPress={() => navigation.navigate("AboutAndLimits")}
        />
        <Spacer />
      </BottomActionBar>

      <ConfirmSheet
        visible={wipeOpen}
        title="Delete every session, test, and evidence?"
        detail="This clears all PocketQA data from app-private storage. This cannot be undone."
        confirmLabel="Delete all data"
        variant="danger"
        onCancel={() => setWipeOpen(false)}
        onConfirm={async () => {
          setWipeOpen(false);
          await PocketQaNative.deleteAllData();
          navigation.replace("StartupGate");
        }}
      />
    </>
  );
}

function SettingRow({
  label, hint, value, onChange, disabled,
}: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={[styles.rowBetween, styles.settingRow, disabled && styles.disabled]}>
      <View style={styles.flex}>
        <Text style={typography.h2}>{label}</Text>
        <Text style={typography.bodyMuted}>{hint}</Text>
      </View>
      <Toggle value={value} onChange={onChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}

function ProviderRow({
  label, hint, masked, configured, onSet, onClear,
}: {
  label: string; hint: string; masked?: string; configured: boolean;
  onSet: () => void; onClear: () => void;
}) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.settingRow}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={typography.h2}>{label}</Text>
          <Text style={typography.bodyMuted}>{hint}</Text>
        </View>
        <StatusPill label={configured ? masked ?? "Configured" : "Off"} tone={configured ? "lime" : "dim"} />
      </View>
      <View style={styles.rowActions}>
        {configured
          ? <DangerButton label="Remove key" onPress={onClear} />
          : <GhostButton label="Set demo key" onPress={onSet} />}
      </View>
    </View>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  rowBetween: layout.rowBetween,
  rowActions: { ...layout.row, gap: spacing.sm, marginTop: spacing.sm },
  settingRow: { paddingVertical: spacing.sm },
  disabled: { opacity: 0.5 },
  flex: layout.fill,
}));
