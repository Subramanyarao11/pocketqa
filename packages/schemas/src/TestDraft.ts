import { z } from 'zod';

export const TestDraftSchema = z.object({
  id: z.string().uuid(),
  intent: z.string().min(1),
  targetPackage: z.string().min(1),
  steps: z.array(z.object({
    action: z.string(),
    selector: z.string().optional(),
    value: z.string().optional(),
  })),
  createdAt: z.string().datetime(),
});

export type TestDraft = z.infer<typeof TestDraftSchema>;
