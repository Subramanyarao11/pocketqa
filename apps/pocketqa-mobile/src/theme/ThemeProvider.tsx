import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from "react";
import { StyleSheet, useColorScheme } from "react-native";
import {
  createTypography,
  darkColors,
  lightColors,
  type ThemeColors,
  type ThemeTypography,
} from "./tokens";

export interface AppTheme {
  scheme: "light" | "dark";
  isDark: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
}

const darkTheme: AppTheme = {
  scheme: "dark",
  isDark: true,
  colors: darkColors,
  typography: createTypography(darkColors),
};

const lightTheme: AppTheme = {
  scheme: "light",
  isDark: false,
  colors: lightColors,
  typography: createTypography(lightColors),
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

/** Build a StyleSheet once per appearance instead of on every component render. */
export function useThemeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T,
): T {
  const theme = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}
