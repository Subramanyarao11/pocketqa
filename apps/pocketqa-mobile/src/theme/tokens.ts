import { Easing, type EasingFunction, type TextStyle, type ViewStyle } from "react-native";

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
  /**
   * Horizontal screen gutter. Deliberately off the 4dp scale — it sits between
   * `lg` and `xl` so cards clear the edge without the content column feeling
   * cramped. `AppScreen` and `TopBar` must agree on it or headers misalign with
   * body content, so it lives here rather than at either call site.
   */
  gutter: 20,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  control: 10,
  input: 12,
  card: 14,
  panel: 18,
  pill: 999,
} as const;

/** Lucide `size` values. Anything outside this scale reads as a mistake. */
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 28,
} as const;

/**
 * Interactive heights and square chrome. `minTouch` is the accessibility floor
 * every pressable must clear (directly or via `hitSlop`).
 */
export const controlSize = {
  minTouch: 44,
  /** Compact inline control — chips, segmented tabs, icon buttons. */
  sm: 36,
  /** Default control height for buttons and inputs. */
  md: 48,
  /** Decorative rounded-square icon backgrounds. */
  tileSm: 40,
  tileMd: 44,
  tileLg: 56,
} as const;

export interface ThemeTypography {
  display: TextStyle;
  brand: TextStyle;
  title: TextStyle;
  subtitle: TextStyle;
  eyebrow: TextStyle;
  h2: TextStyle;
  body: TextStyle;
  bodyMuted: TextStyle;
  metadata: TextStyle;
  mono: TextStyle;
  /** Button and segmented-control labels. */
  button: TextStyle;
  /** Pill and chip labels — the smallest text we ship. */
  pill: TextStyle;
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
    brand: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 30,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 23,
      letterSpacing: -0.2,
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
    button: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20,
      letterSpacing: 0.1,
    },
    pill: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
      letterSpacing: 0.25,
    },
  };
}

/**
 * Shadow recipes. Android reads `elevation`, iOS reads the shadow quadruple, so
 * a preset has to carry both. Dark surfaces get no shadow at all — a black glow
 * on a near-black background only muddies the edge, so depth there comes from
 * the border instead.
 */
export interface ThemeElevation {
  /** Cards and other resting surfaces. */
  card: ViewStyle;
  /** Bars pinned to an edge; the offset points away from the content. */
  barTop: ViewStyle;
  /** Modal sheets — always shadowed, since they float over a scrim. */
  sheet: ViewStyle;
}

export function createElevation(colors: ThemeColors, isDark: boolean): ThemeElevation {
  return {
    card: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.035,
      shadowRadius: 8,
      elevation: isDark ? 0 : 1,
    },
    barTop: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 10,
      elevation: isDark ? 0 : 4,
    },
    sheet: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: isDark ? 0.25 : 0.12,
      shadowRadius: 20,
      elevation: 12,
    },
  };
}

/**
 * A floating control tinted by its own accent rather than by `colors.shadow`,
 * so it stays legible against both palettes.
 */
export function accentGlow(color: string): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  };
}

/**
 * Durations and curves for every animation in the app. Screen transitions are
 * owned by react-navigation and are listed here only so the app's own motion
 * can be tuned to match.
 */
export const motion = {
  duration: {
    /** State flips the user is already looking at — toggles, chips. */
    quick: 180,
    /** Value changes the user is waiting on — progress, reveal. */
    base: 220,
    /** Screen-level transitions. */
    screen: 260,
  },
  easing: {
    /** Default: fast out, settle in. Use unless there's a reason not to. */
    standard: Easing.bezier(0.2, 0, 0, 1) as EasingFunction,
    /** Entering the screen. */
    decelerate: Easing.out(Easing.cubic) as EasingFunction,
    /** Leaving the screen. */
    accelerate: Easing.in(Easing.cubic) as EasingFunction,
  },
} as const;

/**
 * Layout idioms that were being retyped in every `createStyles`. Spread them
 * rather than redeclaring: `row: { ...layout.rowBetween, paddingVertical: … }`.
 */
export const layout = {
  fill: { flex: 1 } as ViewStyle,
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  } as ViewStyle,
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  } as ViewStyle,
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  } as ViewStyle,
  center: { alignItems: "center", justifyContent: "center" } as ViewStyle,
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
