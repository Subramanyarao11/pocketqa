import { useEffect, useRef } from "react";
import { Animated, TouchableOpacity } from "react-native";
import {
  controlSize,
  motion,
  radius,
  useAppTheme,
  useReducedMotion,
  makeStyles,
  useThemeStyles,
  type AppTheme,
} from "@theme";

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB_SIZE = 22;
const THUMB_INSET = 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2;
/** The track is deliberately smaller than the accessibility floor. */
const HIT_SLOP = (controlSize.minTouch - TRACK_HEIGHT) / 2;

/** Accessible switch. The thumb slides; the track colour crossfades with it. */
export function Toggle({
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(position, {
      toValue: value ? 1 : 0,
      duration: reducedMotion ? 0 : motion.duration.quick,
      easing: motion.easing.standard,
      // The track colour interpolates too, and colour isn't native-drivable.
      useNativeDriver: false,
    }).start();
  }, [value, reducedMotion, position]);

  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => !disabled && onChange(!value)}
      activeOpacity={0.72}
      hitSlop={HIT_SLOP}
    >
      <Animated.View
        style={[
          styles.track,
          disabled && styles.disabled,
          {
            backgroundColor: position.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.borderStrong, colors.lime],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, 1],
                    outputRange: [THUMB_INSET, THUMB_INSET + THUMB_TRAVEL],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  thumb: {
    position: "absolute",
    top: THUMB_INSET,
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
