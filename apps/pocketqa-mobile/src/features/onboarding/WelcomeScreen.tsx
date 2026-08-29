import { Text, View } from "react-native";
import { Route, ShieldCheck, WifiOff } from "lucide-react-native";
import type { ScreenProps } from "@navigation";
import { AppScreen, BottomActionBar, Card, PrimaryButton, StatusPill } from "@components";
import { spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

export function WelcomeScreen({ navigation }: ScreenProps<"Welcome">) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  return (
    <>
      <AppScreen safeTop>
        <View style={styles.brandRow}>
          <View style={styles.mark}><ShieldCheck color={colors.lime} size={23} /></View>
          <View>
            <Text style={styles.productName}>PocketQA</Text>
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
            icon={<Route color={colors.cyan} size={20} />}
            title="Reviewable by design"
            detail="Captured actions become an editable test with grounded selectors and assertions."
          />
          <View style={styles.divider} />
          <FeatureRow
            icon={<WifiOff color={colors.lime} size={20} />}
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
        <View style={{ flex: 1 }} />
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
      <View style={styles.featureIcon}>{icon}</View>
      <View style={styles.featureCopy}>
        <Text style={typography.h2}>{title}</Text>
        <Text style={typography.bodyMuted}>{detail}</Text>
      </View>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productName: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: "700" },
  hero: { gap: spacing.md, marginBottom: spacing.lg },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  featureCopy: { flex: 1, gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border },
  noticeHeader: { flexDirection: "row", alignItems: "center" },
});
