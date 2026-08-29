import { z } from 'zod';

/**
 * Canonical UI state contract (ADR-005).
 *
 * This file previously declared `elements[]` with a `type` field and
 * left/top/right/bottom bounds. Nothing imported it, and both live
 * implementations had independently converged on a different shape:
 * `apps/pocketqa-mobile/src/domain/schemas.ts` (`CapturedNode`) and the Kotlin
 * `capture/UiTreeCapture.kt` both emit `nodes[]` with `nodeId`, `role` and
 * `{x, y, w, h}` bounds. So the package ADR-005 designates as the single
 * cross-layer contract was the one thing disagreeing with every layer it was
 * meant to bind.
 *
 * It now matches what capture actually produces. Aligning the contract to the
 * implementations rather than the reverse is deliberate: the implementations are
 * running code with tests, and rewriting them to satisfy a document nobody
 * imported would have been the more expensive mistake.
 *
 * Known gap, tracked rather than papered over: capture does not yet emit display
 * metrics or interaction affordances (`clickable`, `focusable`, `checkable`).
 * Bounds ratios and the 48dp touch-target rule both need the former, and the
 * accessibility rules need the latter. They are optional here so the contract
 * describes today's payload honestly; see `services/ai-lab/app/capture_adapter.py`.
 */

export const BoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});
export type Bounds = z.infer<typeof BoundsSchema>;

export const CapturedNodeSchema = z.object({
  nodeId: z.string(),
  role: z.string(),
  text: z.string().optional(),
  contentDescription: z.string().optional(),
  hintText: z.string().optional(),
  resourceId: z.string().optional(),
  testId: z.string().optional(),
  enabled: z.boolean().default(true),
  visible: z.boolean().default(true),
  bounds: BoundsSchema.optional(),
  /** Redaction decided this node's content is sensitive (spec §14). */
  sensitive: z.boolean().default(false),

  // Not emitted by capture yet. Present so consumers can rely on the field
  // existing, and so the day capture starts reporting them is additive.
  clickable: z.boolean().optional(),
  focusable: z.boolean().optional(),
  checkable: z.boolean().optional(),
  checked: z.boolean().optional(),
  selected: z.boolean().optional(),
});
export type CapturedNode = z.infer<typeof CapturedNodeSchema>;

export const DisplayMetricsSchema = z.object({
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  density: z.number().positive(),
});
export type DisplayMetrics = z.infer<typeof DisplayMetricsSchema>;

export const UiStateSchema = z.object({
  id: z.string(),
  packageName: z.string(),
  screenName: z.string(),
  capturedAt: z.number(),
  screenshotDataUri: z.string().optional(),
  ocrText: z.array(z.string()).default([]),
  nodes: z.array(CapturedNodeSchema),

  /** Required to normalise bounds or evaluate dp-based rules; see the note above. */
  display: DisplayMetricsSchema.optional(),
  semanticFingerprint: z.string().optional(),
});
export type UiState = z.infer<typeof UiStateSchema>;
