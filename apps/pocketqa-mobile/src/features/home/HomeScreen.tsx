import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { FlaskConical, Plus, Settings2, TestTubeDiagonal } from "lucide-react-native";
import type { ScreenProps } from "@navigation";
import {
  AppScreen, BottomActionBar, Card, EmptyState, GhostButton, InlineNotice,
  PrimaryButton, StatusPill, TopBar,
} from "@components";
import { PocketQaNative, type TestListItem } from "@native";
import { useReadinessStore } from "@store";
import { spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

export function HomeScreen({ navigation }: ScreenProps<"Home">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const readiness = useReadinessStore((s) => s.readiness);
  const [tests, setTests] = useState<TestListItem[]>([]);

  useEffect(() => {
    const load = () => PocketQaNative.listTests().then(setTests).catch(() => {});
    const unsub = navigation.addListener("focus", load);
    load();
    return unsub;
  }, [navigation]);

  const captureReady = !!readiness?.accessibilityEnabled;

  return (
    <>
      <TopBar
        title="Test library"
        subtitle="Approved mobile automations"
        right={<StatusPill label={readiness?.offlineMode ? "Local mode" : "Online"} tone={readiness?.offlineMode ? "lime" : "cyan"} />}
      />
      <AppScreen>
        {!captureReady && (
          <InlineNotice
            title="Set up capture"
            detail="Enable the AccessibilityService before recording your first flow."
            tone="warn"
          />
        )}
        {tests.length === 0 ? (
          <EmptyState
            title="No tests yet"
            detail="Show PocketQA one flow and turn it into a regression test."
            icon={<View style={styles.emptyIcon}><TestTubeDiagonal color={colors.cyan} size={28} /></View>}
            action={{ label: "Create first test", onPress: () => navigation.navigate("Intent") }}
          />
        ) : (
          <>
            <Text style={typography.eyebrow}>Recent</Text>
            <FlatList
              data={tests}
              keyExtractor={(t) => t.id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: spacing.sm }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => navigation.navigate("ReplayMissionControl", { testId: item.id, version: item.version })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open test ${item.name}, version ${item.version}`}
                  accessibilityHint="Replays the approved test against the target app."
                >
                  <Card>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={typography.h2}>{item.name}</Text>
                        <Text style={typography.metadata}>v{item.version} · {item.packageName}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
                        <StatusPill
                          label={item.lastRunPassed === undefined ? "Not run" : item.lastRunPassed ? "PASS" : "FAIL"}
                          tone={item.lastRunPassed === undefined ? "dim" : item.lastRunPassed ? "lime" : "red"}
                        />
                        <StatusPill label={item.compiledBy} tone="dim" />
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              )}
            />
          </>
        )}

        <Text style={typography.eyebrow}>Explore</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("AgentLab")}
          accessibilityRole="button"
          accessibilityLabel="Agent Lab"
          accessibilityHint="Bounded exploration mission with proposal review."
        >
          <Card tone="info">
            <View style={styles.rowBetween}>
              <View style={styles.exploreLead}>
                <View style={styles.exploreIcon}><FlaskConical color={colors.violet} size={21} /></View>
                <View style={styles.flex}>
                  <Text style={typography.h2}>Agent Lab</Text>
                  <Text style={typography.bodyMuted}>
                    Find one nearby untested state inside explicit safety bounds.
                  </Text>
                </View>
              </View>
              <StatusPill label="Experimental" tone="violet" />
            </View>
          </Card>
        </TouchableOpacity>
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Settings" icon={<Settings2 color={colors.text} size={17} />} onPress={() => navigation.navigate("Settings")} />
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="New test"
          icon={<Plus color={colors.onAccent} size={18} strokeWidth={2.5} />}
          onPress={() =>
            captureReady
              ? navigation.navigate("Intent")
              : navigation.navigate("Readiness", { returnTo: "Intent" })
          }
        />
      </BottomActionBar>
    </>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  flex: { flex: 1 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.infoSurface,
    marginBottom: spacing.xs,
  },
  exploreLead: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  exploreIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.aiSurface,
  },
});
