# PocketQA mobile — UI conventions

Rules for anything under `src/`. Most are enforced by `.eslintrc.js`; the rest are
here because a linter can't see them.

## Styling

Plain `StyleSheet`, no styling library. Every component follows one shape:

```tsx
export function Thing() {
  const { colors, typography } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  return <View style={styles.root} />;
}

const createStyles = makeStyles(({ colors }: AppTheme) => ({
  root: { padding: spacing.lg, backgroundColor: colors.surface },
}));
```

- `createStyles` goes at the bottom of the file and takes the whole `AppTheme`.
- The `makeStyles` wrapper is not decoration. Without it TypeScript infers the
  object on its own and widens `flexDirection: "row"` to `string`, which then
  fails to match `ViewStyle` at every call site — that single omission was worth
  ~100 type errors. It also turns a misspelled style property into an error here
  instead of silence at runtime.
- Never call `StyleSheet.create` at module scope in `components/` or `features/` —
  it captures the dark palette forever and won't repaint on an appearance change.
  The only exception is a file with no theme values at all, and there is no
  good reason to have one.
- No inline `style={{…}}`. It's the hole every magic number comes through.

## Tokens

Everything visual comes from `@theme`. If a value you need isn't there, add it to
`src/theme/tokens.ts` rather than inlining it once.

| What | Token | Notes |
|---|---|---|
| Colour | `colors.*` via `useAppTheme()` | Semantic keys only; no hex anywhere outside `src/theme/` |
| Space | `spacing.*` | `spacing.gutter` (20) is the screen edge — `AppScreen` and `TopBar` must agree |
| Corner | `radius.*` | |
| Text | `typography.*` | Never a bare `fontSize`/`fontWeight` pair |
| Icon | `iconSize.*` | Lucide `size=` |
| Height | `controlSize.*` | `minTouch` (48) is the floor for anything pressable |
| Shadow | `elevation.*` from `useAppTheme()` | `accentGlow(color)` for tinted floating controls |
| Animation | `motion.duration.*`, `motion.easing.*` | |
| Row/fill | `layout.*` | Spread it: `{ ...layout.rowBetween, paddingVertical: spacing.sm }` |

`colors` and `typography` exported directly from `tokens.ts` are dark-only
fallbacks for non-rendered helpers. Rendering code uses the hook.

## Components

Import from `@components`, never `@components/SomeFile` — the deep path can
resolve to a file the barrel doesn't export.

Before hand-rolling a control, check that it doesn't exist: `TextField`,
`Checkbox`, `Radio`/`RadioIndicator`, `Chip`, `SegmentedControl`, `Toggle`,
`ProgressBar`, `IconTile`, `IconButton`, `LinkButton`, `CodeChip`, `LogView`,
`Spacer`, `StatusPill`, `Card`, `EmptyState`, `InlineNotice`, `ConfirmSheet`.

If two features need the same control, it belongs in `components/`. Features
never import each other.

`RadioIndicator` and `CheckboxIndicator` are visual only — use them inside a
pressable that already carries the `radio`/`checkbox` role, or the option gets
announced twice.

## Motion

React Native `Animated`, not Reanimated (installed but unused; the Jest setup
doesn't mock it). Any animated component must read `useReducedMotion()` and pass
`duration: 0` when it's true — jump to the end state, never skip the update.

## Accessibility

- Every pressable clears 48dp, directly or via `hitSlop`.
- Icon-only controls require `accessibilityLabel`. So do all `TextField`s.
- Never signal state with colour alone; pair it with a label or an icon.

## Lists

`ScrollView` + `.map()` is fine for bounded content. Anything that grows with
user data gets a `FlatList` that owns the scroll — pass `scroll={false}` to
`AppScreen` and move the padding into `contentContainerStyle`. A `FlatList`
inside `AppScreen`'s `ScrollView` is not virtualized.

Append-only traces go through `LogView`, which caps how many lines mount.
