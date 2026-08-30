import { Text, View } from "react-native";
import { Route, ShieldCheck, WifiOff } from "lucide-react-native";
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
  IconTile,
  PrimaryButton,
  Spacer,
  StatusPill,
} from "@components";
import { type ScreenProps } from "@navigation";

export function WelcomeScreen({ navigation }: ScreenProps<"Welcome">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  return (
    <>
      <AppScreen safeTop>
        <View style={styles.brandRow}>
          <IconTile size="md" tone="lime" bordered>
            <ShieldCheck color={colors.lime} size={iconSize.xl} />
          </IconTile>
          <View>
            <Text style={typography.subtitle}>PocketQA</Text>
            <Text style={typography.metadata}>Mobile test authoring</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={typography.eyebrow}>From intent to evidence</Text>
          <Text style={typography.display}>Show the flow once. Keep it tested.</Text>
          <Text style={typography.bodyMuted}>
            Describe what matters, demonstrate it in your app, and review a deterministic regression test before anything runs.
          </Text>
        </View>

        <Card>
          <FeatureRow
            icon={<Route color={colors.cyan} size={iconSize.lg} />}
            title="Reviewable by design"
            detail="Captured actions become an editable test with grounded selectors and assertions."
          />
          <View style={styles.divider} />
          <FeatureRow
            icon={<WifiOff color={colors.lime} size={iconSize.lg} />}
            title="Local by default"
            detail="Capture, compile, replay, and evidence remain available without a network."
          />
        </Card>

        <Card tone="info">
          <View style={styles.noticeHeader}>
            <StatusPill label="Human approval required" tone="cyan" />
          </View>
          <Text style={typography.bodyMuted}>
            AI may propose. Only the deterministic executor acts, and only inside the app you approve.
          </Text>
        </Card>
      </AppScreen>
      <BottomActionBar>
        <Spacer />
        <PrimaryButton label="Continue" onPress={() => navigation.navigate("Disclosure")} />
      </BottomActionBar>
    </>
  );
}

function FeatureRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.featureRow}>
      <IconTile size="sm">{icon}</IconTile>
      <View style={styles.featureCopy}>
        <Text style={typography.h2}>{title}</Text>
        <Text style={typography.bodyMuted}>{detail}</Text>
      </View>
    </View>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  brandRow: { ...layout.row, marginBottom: spacing.xl },
  hero: { gap: spacing.md, marginBottom: spacing.lg },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  featureCopy: { flex: 1, gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border },
  noticeHeader: layout.row,
}));
