import { Text, View } from "react-native";
import { layout, makeStyles, spacing, useAppTheme, useThemeStyles, type AppTheme } from "@theme";
import { Card, type CardTone } from "@components";

export interface InlineNoticeProps {
  title: string;
  detail?: string;
  tone?: CardTone;
  icon?: React.ReactNode;
}

/** Info/warning/error/local-mode strip. Never rely on colour alone. */
export function InlineNotice({ title, detail, tone = "info", icon }: InlineNoticeProps) {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const roleForTone = tone === "danger" ? "alert" : "summary";
  const spoken = detail ? `${title}. ${detail}` : title;
  return (
    <Card tone={tone}>
      <View
        style={styles.row}
        accessible
        accessibilityRole={roleForTone as never}
        accessibilityLabel={spoken}
      >
        {icon}
        <View style={layout.fill}>
          <Text style={[typography.h2, { color: colors.text }]}>{title}</Text>
          {detail ? <Text style={typography.bodyMuted}>{detail}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const createStyles = makeStyles((_theme: AppTheme) => ({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
}));
