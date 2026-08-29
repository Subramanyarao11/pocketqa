import { z } from 'zod';

export const MissionSchema = z.object({
  id: z.string().uuid(),
  intent: z.string().min(1),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  testDraftId: z.string().uuid().optional(),
});

export type Mission = z.infer<typeof MissionSchema>;
