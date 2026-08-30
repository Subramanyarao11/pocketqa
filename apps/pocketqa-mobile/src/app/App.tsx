import { useEffect, useRef } from "react";
import { AppState, StatusBar, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "@navigation";
import { PocketQaNative } from "@native";
import { useActiveOperationStore, useReadinessStore } from "@store";
import { AppThemeProvider, layout, useAppTheme } from "@theme";

export default function App() {
  return (
    <GestureHandlerRootView style={layout.fill}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AppRoot />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppRoot() {
  const applyEvent = useActiveOperationStore((s) => s.applyEvent);
  const hydrate = useActiveOperationStore((s) => s.hydrate);
  const refreshReadiness = useReadinessStore((s) => s.refresh);
  // RN 0.87 types currentState as nullable: it is undefined before the first
  // state event on Android. Narrow once here rather than at each read.
  const lastState = useRef<AppStateStatus>(
    (AppState.currentState ?? "active") as AppStateStatus,
  );
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    hydrate().catch(() => {});
    refreshReadiness().catch(() => {});
    const off = PocketQaNative.addListener(applyEvent);
    return () => off();
  }, [applyEvent, hydrate, refreshReadiness]);

  // §10 — session persistence. When the user backgrounds mid-capture/replay,
  // ask the native coordinator to persist a checkpoint; on foreground, rehydrate
  // the active operation and refresh readiness (accessibility service may have
  // been disabled while we were away).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = lastState.current;
      lastState.current = next;
      if (prev === "active" && next.match(/inactive|background/)) {
        PocketQaNative.checkpointActiveOperation().catch(() => {});
      }
      if (prev.match(/inactive|background/) && next === "active") {
        hydrate().catch(() => {});
        refreshReadiness().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [hydrate, refreshReadiness]);

  return (
    <>
      {/* backgroundColor is Android-only in the RN 0.87 typings. */}
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <RootNavigator />
    </>
  );
}
