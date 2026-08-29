import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@theme";
import { Card, type CardTone } from "./Card";

export interface InlineNoticeProps {
  title: string;
  detail?: string;
  tone?: CardTone;
  icon?: React.ReactNode;
}

/** Info/warning/error/local-mode strip. Never rely on colour alone. */
export function InlineNotice({ title, detail, tone = "info", icon }: InlineNoticeProps) {
  return (
    <Card tone={tone}>
      <View style={styles.row}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={[typography.h2, { color: colors.text }]}>{title}</Text>
          {detail ? <Text style={typography.bodyMuted}>{detail}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
});
