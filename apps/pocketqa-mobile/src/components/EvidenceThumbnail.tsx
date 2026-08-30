import { Image, Text, View } from "react-native";
import { ImageOff } from "lucide-react-native";
import {
  iconSize,
  layout,
  radius,
  spacing,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
} from "@theme";

export interface EvidenceThumbnailProps {
  screenName: string;
  /** Redacted screenshot. A `data:` or `content://` URI from the native side. */
  uri?: string;
  redactionCount?: number;
}

/**
 * Redacted preview of a captured state. Falls back to a labelled placeholder
 * when the native side has no screenshot for the state — evidence can be
 * pruned, and a missing image must not read as an empty screen.
 */
export function EvidenceThumbnail({ screenName, uri, redactionCount = 0 }: EvidenceThumbnailProps) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const spoken = uri
    ? `Evidence: ${screenName}, ${redactionCount} redactions applied`
    : `Evidence: ${screenName}, no screenshot captured`;

  return (
    <View style={styles.wrap} accessible accessibilityLabel={spoken}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.image, layout.center]}>
          <ImageOff color={colors.textDim} size={iconSize.xl} />
        </View>
      )}
      <Text style={typography.metadata} numberOfLines={1}>{screenName}</Text>
      {redactionCount > 0 && (
        <Text style={[typography.metadata, { color: colors.amber }]}>
          {redactionCount} redaction{redactionCount === 1 ? "" : "s"}
        </Text>
      )}
    </View>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  wrap: {
    borderRadius: radius.card,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    minWidth: 108,
  },
  image: {
    aspectRatio: 9 / 16,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceMuted,
  },
}));
