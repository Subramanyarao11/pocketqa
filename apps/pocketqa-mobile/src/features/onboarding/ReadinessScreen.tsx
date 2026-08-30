import { useEffect } from "react";
import { View } from "react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, GhostButton, InlineNotice, PrimaryButton,
  ReadinessRow, Spacer, TopBar,
} from "@components";
import { PocketQaNative } from "@native";
import { useReadinessStore } from "@store";

export function ReadinessScreen({ navigation }: ScreenProps<"Readiness">) {
  const readiness = useReadinessStore((s) => s.readiness);
  const refresh = useReadinessStore((s) => s.refresh);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  if (!readiness) return <AppScreen><Card><View /></Card></AppScreen>;

  const primaryReady = readiness.accessibilityEnabled && readiness.storageOk;

  return (
    <>
      <TopBar title="Device readiness" subtitle="Local capabilities and permissions" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card>
          <ReadinessRow
            label="Accessibility service"
            status={readiness.accessibilityEnabled ? "ready" : "needs-action"}
            detail="PocketQA uses AccessibilityService to read the UI tree during a session."
            action={readiness.accessibilityEnabled ? undefined : {
              label: "Open settings",
              onPress: () => PocketQaNative.openAccessibilitySettings().then(() => refresh()),
            }}
          />
          <ReadinessRow
            label="Screenshot capability"
            status={readiness.screenshotSupported ? "ready" : "unsupported"}
            detail="AccessibilityService screenshot API on Android API 30+."
          />
          <ReadinessRow
            label="Local storage"
            status={readiness.storageOk ? "ready" : "needs-action"}
            detail="App-private database and evidence files."
          />
          <ReadinessRow
            label="Microphone (voice intent)"
            status={readiness.microphoneReady ? "ready" : "optional-unavailable"}
            detail="Only used on the intent screen. Never triggers an action."
          />
          <ReadinessRow
            label="On-device Prompt API"
            status={readiness.onDeviceModel === "ready" ? "ready" : "optional-unavailable"}
            detail={
              readiness.onDeviceModel === "ready"
                ? "Gemini Nano available for local structured ranking."
                : "Unsupported — deterministic local compiler is the guaranteed path."
            }
          />
          <ReadinessRow
            label="Demo Shop installed"
            status={readiness.demoShopInstalled ? "ready" : "needs-action"}
            detail="The team-owned target app. Only allowlisted packages appear."
          />
        </Card>

        {readiness.onDeviceModel !== "ready" && (
          <InlineNotice
            title="Deterministic local mode"
            detail="Unsupported on-device AI does not block the MVP. The deterministic local compiler is the guaranteed path."
            tone="info"
          />
        )}
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Recheck" onPress={() => refresh()} />
        <Spacer />
        <PrimaryButton
          label="Continue"
          disabled={!primaryReady}
          onPress={() => navigation.replace("Home")}
        />
      </BottomActionBar>
    </>
  );
}
