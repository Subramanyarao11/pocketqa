/**
 * Design tokens — Build Spec §9.
 * Semantic names only.  Never import raw hex from a screen.
 */
export const colors = {
  background: "#080B10",
  surface: "#111822",
  surfaceRaised: "#17212D",
  border: "#2A3645",
  borderStrong: "#3B4C60",
  text: "#F7FAFC",
  textMuted: "#A7B2C2",
  textDim: "#6C7A8B",
  lime: "#C7FF4A", // ready, approved, local execution
  cyan: "#59D9FF", // information and evidence
  amber: "#F2B84B", // review required / degraded
  red: "#FF667A",   // failed / hard stop
  violet: "#B48CFF", // AI proposal
  scrim: "rgba(0,0,0,0.64)",
} as const;

/** 4dp base unit; canonical rhythm from §9.2. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  card: 16,
  input: 12,
  pill: 999,
} as const;

export const typography = {
  eyebrow: { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" as const, color: colors.textDim },
  title: { fontSize: 20, fontWeight: "600" as const, color: colors.text, letterSpacing: -0.2 },
  h2: { fontSize: 15, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  bodyMuted: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  metadata: { fontSize: 12, color: colors.textDim } as { fontSize: 12; color: string },
} as const;

export const timings = {
  quick: 180,
  screen: 260,
} as const;

/** Semantic status → colour resolver. */
export type StatusTone = "lime" | "cyan" | "amber" | "red" | "violet" | "dim";
export const toneColor: Record<StatusTone, string> = {
  lime: colors.lime,
  cyan: colors.cyan,
  amber: colors.amber,
  red: colors.red,
  violet: colors.violet,
  dim: colors.textDim,
};
