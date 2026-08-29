import { Text, View } from "react-native";
import { radius, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

/**
 * Redacted image placeholder for a captured state.  Native side will
 * provide a `content://` URI in the real build; until then, we render a
 * labeled tile with an accessible description.
 */
export function EvidenceThumbnail({
  screenName,
  uri,
  redactionCount = 0,
}: {
  screenName: string;
  uri?: string;
  redactionCount?: number;
}) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.wrap} accessibilityLabel={`Evidence: ${screenName}, ${redactionCount} redactions applied`}>
      <View style={styles.image}>
        <Text style={{ color: colors.textDim, fontSize: 24 }}>▢</Text>
      </View>
      <Text style={typography.metadata} numberOfLines={1}>{uri ? "content://…" : screenName}</Text>
      {redactionCount > 0 && (
        <Text style={[typography.metadata, { color: colors.amber }]}>
          {redactionCount} redaction{redactionCount === 1 ? "" : "s"}
        </Text>
      )}
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) => ({
  wrap: {
    borderRadius: radius.card,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
    minWidth: 108,
  },
  image: {
    aspectRatio: 9 / 16,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
});
