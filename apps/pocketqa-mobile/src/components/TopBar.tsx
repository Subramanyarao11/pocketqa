import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  controlSize,
  iconSize,
  layout,
  radius,
  spacing,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
} from "@theme";

export interface TopBarProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}

/** Predictable-height top bar with optional back + context action. */
export function TopBar({ title, subtitle, onBack, right }: TopBarProps) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  );
  return (
    <View style={[styles.safe, { paddingTop: topInset }]}>
      <View style={styles.root} accessibilityRole="header">
        <View style={styles.leftGroup}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              style={styles.backBtn}
            >
              <ChevronLeft color={colors.text} size={iconSize.lg} strokeWidth={2.2} />
            </TouchableOpacity>
          )}
          <View style={styles.titleGroup}>
            <Text style={typography.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={typography.bodyMuted} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        {right ? <View>{right}</View> : null}
      </View>
    </View>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  safe: { backgroundColor: colors.background },
  root: {
    ...layout.rowBetween,
    minHeight: 64,
    paddingVertical: spacing.sm,
    // Must match AppScreen's gutter or the header sits off the content column.
    paddingHorizontal: spacing.gutter,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leftGroup: { ...layout.row, flex: 1 },
  titleGroup: { minWidth: 0, flexShrink: 1 },
  backBtn: {
    width: controlSize.tileSm,
    height: controlSize.tileSm,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...layout.center,
  },
}));
