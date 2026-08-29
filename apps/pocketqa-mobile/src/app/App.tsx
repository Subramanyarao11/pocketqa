import { useEffect } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "@navigation";
import { PocketQaNative } from "@native";
import { useActiveOperationStore, useReadinessStore } from "@store";
import { colors } from "@theme";

export default function App() {
  const applyEvent = useActiveOperationStore((s) => s.applyEvent);
  const hydrate = useActiveOperationStore((s) => s.hydrate);
  const refreshReadiness = useReadinessStore((s) => s.refresh);

  useEffect(() => {
    hydrate().catch(() => {});
    refreshReadiness().catch(() => {});
    const off = PocketQaNative.addListener(applyEvent);
    return () => off();
  }, [applyEvent, hydrate, refreshReadiness]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
