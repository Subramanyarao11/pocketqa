import { z } from 'zod';

export const UiStateSchema = z.object({
  screenId: z.string(),
  elements: z.array(z.object({
    id: z.string(),
    type: z.string(),
    text: z.string().optional(),
    contentDescription: z.string().optional(),
    bounds: z.object({
      left: z.number(),
      top: z.number(),
      right: z.number(),
      bottom: z.number(),
    }),
  })),
  timestamp: z.string().datetime(),
});

export type UiState = z.infer<typeof UiStateSchema>;
