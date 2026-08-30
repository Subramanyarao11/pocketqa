import { Text, View } from "react-native";
import { makeStyles, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";

export interface LogViewProps {
  lines: string[];
  /** Shown in place of the log while it is still empty. */
  emptyLabel: string;
  /**
   * Most recent lines to render. Live traces grow without bound, and every
   * line is a `<Text>`, so the tail is the only part worth mounting.
   */
  maxLines?: number;
}

const DEFAULT_MAX_LINES = 120;

/** Monospaced append-only trace. */
export function LogView({ lines, emptyLabel, maxLines = DEFAULT_MAX_LINES }: LogViewProps) {
  const { typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);

  if (lines.length === 0) {
    return <Text style={typography.bodyMuted}>{emptyLabel}</Text>;
  }

  const hidden = Math.max(0, lines.length - maxLines);
  const visible = hidden > 0 ? lines.slice(hidden) : lines;

  return (
    <View accessible accessibilityLabel={`Log, ${lines.length} entries`}>
      {hidden > 0 && (
        <Text style={typography.metadata}>{`${hidden} earlier line${hidden === 1 ? "" : "s"} hidden`}</Text>
      )}
      {visible.map((line, index) => (
        <Text key={hidden + index} style={[typography.mono, styles.line]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  line: { paddingVertical: spacing.xxs },
}));
