import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  createElevation,
  createTypography,
  darkColors,
  lightColors,
  type ThemeColors,
  type ThemeElevation,
  type ThemeTypography,
} from "./tokens";

export interface AppTheme {
  scheme: "light" | "dark";
  isDark: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  elevation: ThemeElevation;
}

const darkTheme: AppTheme = {
  scheme: "dark",
  isDark: true,
  colors: darkColors,
  typography: createTypography(darkColors),
  elevation: createElevation(darkColors, true),
};

const lightTheme: AppTheme = {
  scheme: "light",
  isDark: false,
  colors: lightColors,
  typography: createTypography(lightColors),
  elevation: createElevation(lightColors, false),
};

const ThemeContext = createContext<AppTheme>(darkTheme);

/** Follows the Android/iOS appearance setting and updates live. */
export function AppThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const theme = scheme === "light" ? lightTheme : darkTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}

export type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Identity wrapper for a `createStyles` factory. It exists purely for the
 * generic constraint: without it the returned object literal is inferred on its
 * own and `flexDirection: "row"` widens to `string`, which then fails to match
 * `ViewStyle` at every call site. Wrapping it contextually types the literal so
 * the enum-ish properties stay narrow and typos are caught here rather than
 * silently swallowed by an `any` further down.
 */
export function makeStyles<T extends NamedStyles<T>>(
  factory: (theme: AppTheme) => T,
): (theme: AppTheme) => T {
  return factory;
}

/** Build a StyleSheet once per appearance instead of on every component render. */
export function useThemeStyles<T extends NamedStyles<T>>(factory: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}

/**
 * True when the OS asks for reduced motion. Animated components should jump to
 * their end state instead of tweening — pass `duration: 0`, don't skip the
 * update, or the UI stops reflecting its own state.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
