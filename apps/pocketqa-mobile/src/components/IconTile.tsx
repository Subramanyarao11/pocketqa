import { View, type ViewStyle } from "react-native";
import {
  controlSize,
  layout,
  radius,
  toneSurface,
  useAppTheme,
  makeStyles,
  useThemeStyles,
  type AppTheme,
  type StatusTone,
} from "@theme";

export type IconTileSize = "sm" | "md" | "lg";

export interface IconTileProps {
  children: React.ReactNode;
  size?: IconTileSize;
  /** Background is the tone's surface; pass the matching tone to the icon too. */
  tone?: StatusTone;
  bordered?: boolean;
  style?: ViewStyle;
}

const DIMENSION: Record<IconTileSize, number> = {
  sm: controlSize.tileSm,
  md: controlSize.tileMd,
  lg: controlSize.tileLg,
};

/**
 * Decorative rounded square behind an icon. Purely visual — it hides itself
 * from screen readers so the surrounding copy carries the meaning.
 */
export function IconTile({ children, size = "md", tone = "dim", bordered = false, style }: IconTileProps) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const dimension = DIMENSION[size];
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: dimension,
          height: dimension,
          borderRadius: size === "lg" ? radius.panel : radius.input,
          backgroundColor: toneSurface(colors, tone),
        },
        bordered && styles.bordered,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  tile: layout.center,
  bordered: { borderWidth: 1, borderColor: colors.border },
}));
