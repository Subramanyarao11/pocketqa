import { z } from 'zod';

export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  testDraftId: z.string().uuid(),
  result: z.enum(['pass', 'fail', 'error']),
  screenshots: z.array(z.string()),
  logs: z.array(z.string()),
  duration: z.number(),
  timestamp: z.string().datetime(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
