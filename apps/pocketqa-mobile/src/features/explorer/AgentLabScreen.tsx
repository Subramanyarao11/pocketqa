import { useState } from "react";
import { Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
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
  PrimaryButton,
  Spacer,
  StatusPill,
  TextField,
  TopBar,
} from "@components";
import { ALLOWLISTED_PACKAGES } from "@domain";
import { PocketQaNative } from "@native";
import { type ScreenProps } from "@navigation";

export function AgentLabScreen({ navigation }: ScreenProps<"AgentLab">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const [goal, setGoal] = useState("Find a nearby checkout state we forgot to test after applying a coupon.");
  const [budget, setBudget] = useState(3);
  const [seconds, setSeconds] = useState(60);

  return (
    <>
      <TopBar title="Agent Lab" subtitle="Bounded exploratory testing" onBack={() => navigation.goBack()} />
      <AppScreen>
        <Card tone="info">
          <StatusPill label="Internal lab mode" tone="violet" />
          <Text style={typography.bodyMuted}>
            Explorer proposes actions inside a bounded mission. Payments, accounts, permissions,
            destructive actions, sensitive fields, system UI, and other apps are always blocked.
          </Text>
        </Card>

        <Card>
          <Text style={typography.eyebrow}>Mission goal</Text>
          <TextField
            value={goal}
            onChangeText={setGoal}
            variant="multiline"
            rows={3}
            accessibilityLabel="Mission goal"
          />
        </Card>

        <Card>
          <Text style={typography.eyebrow}>Bounds</Text>
          <View style={styles.rowBetween}>
            <Text style={typography.body}>Max actions</Text>
            <View style={styles.stepper}>
              <StepperButton label="-" onPress={() => setBudget(Math.max(1, budget - 1))} />
              <Text style={typography.body}>{budget}</Text>
              <StepperButton label="+" onPress={() => setBudget(Math.min(5, budget + 1))} />
            </View>
          </View>
          <View style={styles.rowBetween}>
            <Text style={typography.body}>Max seconds</Text>
            <View style={styles.stepper}>
              <StepperButton label="-15" onPress={() => setSeconds(Math.max(15, seconds - 15))} />
              <Text style={typography.body}>{seconds}s</Text>
              <StepperButton label="+15" onPress={() => setSeconds(Math.min(90, seconds + 15))} />
            </View>
          </View>
          <View style={styles.pills}>
            <StatusPill label={`Allowlist: ${ALLOWLISTED_PACKAGES[0]}`} tone="lime" />
            <StatusPill label="Tools: observe, tapNode, back, waitForIdle, stop" tone="dim" />
          </View>
        </Card>
      </AppScreen>
      <BottomActionBar>
        <GhostButton label="Cancel" onPress={() => navigation.goBack()} />
        <Spacer />
        <PrimaryButton
          label="Review mission"
          icon={<ShieldCheck color={colors.onAccent} size={iconSize.md} />}
          onPress={async () => {
            const mission = await PocketQaNative.createMission({
              goal,
              packageAllowlist: [...ALLOWLISTED_PACKAGES],
              maxActions: budget,
              maxDurationSeconds: seconds,
            });
            navigation.navigate("MissionReview", { missionId: mission.id });
          }}
        />
      </BottomActionBar>
    </>
  );
}

function StepperButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <GhostButton label={label} onPress={onPress} />
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  rowBetween: { ...layout.rowBetween, paddingVertical: spacing.xs },
  stepper: { ...layout.row, gap: spacing.sm },
  pills: { ...layout.rowWrap, marginTop: spacing.sm },
}));
