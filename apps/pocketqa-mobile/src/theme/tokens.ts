import type { TextStyle } from "react-native";

/**
 * PocketQA's semantic colour contract. Screens consume meaning rather than raw
 * hex values so the same hierarchy works in light and dark appearances.
 */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  lime: string;
  cyan: string;
  amber: string;
  red: string;
  violet: string;
  onAccent: string;
  scrim: string;
  shadow: string;
  successSurface: string;
  infoSurface: string;
  warningSurface: string;
  dangerSurface: string;
  aiSurface: string;
}

/** Restrained ink-and-slate palette for focused engineering work. */
export const darkColors: ThemeColors = {
  background: "#0B1118",
  surface: "#111A24",
  surfaceRaised: "#17222E",
  surfaceMuted: "#1C2936",
  border: "#263544",
  borderStrong: "#3A4B5D",
  text: "#F4F7FA",
  textMuted: "#AAB6C4",
  textDim: "#748394",
  lime: "#B7E46A",
  cyan: "#65C8E8",
  amber: "#E5B65B",
  red: "#F07382",
  violet: "#A78BE8",
  onAccent: "#142006",
  scrim: "rgba(3, 7, 12, 0.72)",
  shadow: "#000000",
  successSurface: "#172413",
  infoSurface: "#10242C",
  warningSurface: "#2A2112",
  dangerSurface: "#2A171B",
  aiSurface: "#211B2E",
};

/** Neutral daylight palette with WCAG-conscious semantic accents. */
export const lightColors: ThemeColors = {
  background: "#F3F6F8",
  surface: "#FFFFFF",
  surfaceRaised: "#F8FAFB",
  surfaceMuted: "#EDF2F5",
  border: "#DCE3E8",
  borderStrong: "#B9C5CF",
  text: "#17212B",
  textMuted: "#536171",
  textDim: "#738191",
  lime: "#4E741A",
  cyan: "#08677F",
  amber: "#86540B",
  red: "#B6374B",
  violet: "#6446A8",
  onAccent: "#FFFFFF",
  scrim: "rgba(15, 23, 32, 0.48)",
  shadow: "#17212B",
  successSurface: "#F1F8E8",
  infoSurface: "#EAF6FA",
  warningSurface: "#FFF7E8",
  dangerSurface: "#FFF0F2",
  aiSurface: "#F4F0FB",
};

/** 4dp base unit; canonical rhythm from the build spec. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  control: 10,
  input: 12,
  card: 14,
  panel: 18,
  pill: 999,
} as const;

export interface ThemeTypography {
  display: TextStyle;
  eyebrow: TextStyle;
  title: TextStyle;
  h2: TextStyle;
  body: TextStyle;
  bodyMuted: TextStyle;
  metadata: TextStyle;
  mono: TextStyle;
}

export function createTypography(colors: ThemeColors): ThemeTypography {
  return {
    display: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "700",
      lineHeight: 37,
      letterSpacing: -0.7,
    },
    eyebrow: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
      letterSpacing: 1.25,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "700",
      lineHeight: 28,
      letterSpacing: -0.35,
    },
    h2: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      lineHeight: 22,
      letterSpacing: -0.1,
    },
    body: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "400",
      lineHeight: 22,
    },
    bodyMuted: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 21,
    },
    metadata: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 17,
    },
    mono: {
      color: colors.textMuted,
      fontFamily: "monospace",
      fontSize: 12,
      lineHeight: 18,
    },
  };
}

export const timings = {
  quick: 180,
  screen: 260,
} as const;

export type StatusTone = "lime" | "cyan" | "amber" | "red" | "violet" | "dim";

export function toneForeground(colors: ThemeColors, tone: StatusTone): string {
  switch (tone) {
    case "lime": return colors.lime;
    case "cyan": return colors.cyan;
    case "amber": return colors.amber;
    case "red": return colors.red;
    case "violet": return colors.violet;
    case "dim": return colors.textDim;
  }
}

export function toneSurface(colors: ThemeColors, tone: StatusTone): string {
  switch (tone) {
    case "lime": return colors.successSurface;
    case "cyan": return colors.infoSurface;
    case "amber": return colors.warningSurface;
    case "red": return colors.dangerSurface;
    case "violet": return colors.aiSurface;
    case "dim": return colors.surfaceMuted;
  }
}

// Backward-compatible dark defaults for non-rendered helpers. UI code should
// use `useAppTheme()` so appearance changes update without a reload.
export const colors = darkColors;
export const typography = createTypography(darkColors);
