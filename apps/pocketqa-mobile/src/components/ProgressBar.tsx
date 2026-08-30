import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import {
  motion,
  radius,
  spacing,
  toneForeground,
  useAppTheme,
  useReducedMotion,
  makeStyles,
  useThemeStyles,
  type AppTheme,
  type StatusTone,
} from "@theme";

export interface ProgressBarProps {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  tone?: StatusTone;
  /** Spoken description of what is progressing, e.g. "Replay progress". */
  accessibilityLabel: string;
}

const TRACK_HEIGHT = 6;

/** Determinate progress track. Animates unless the OS asks it not to. */
export function ProgressBar({ value, tone = "lime", accessibilityLabel }: ProgressBarProps) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, value));
  const width = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: clamped,
      duration: reducedMotion ? 0 : motion.duration.base,
      easing: motion.easing.standard,
      // Percentage widths can't run on the UI thread.
      useNativeDriver: false,
    }).start();
  }, [clamped, reducedMotion, width]);

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: toneForeground(colors, tone),
            width: width.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  fill: { height: TRACK_HEIGHT, borderRadius: radius.xs },
}));
