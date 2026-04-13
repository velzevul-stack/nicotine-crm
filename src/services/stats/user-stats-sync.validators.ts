import { z } from 'zod';

export const syncUserStatsBodySchema = z.object({
  usageDays: z.array(z.string()).optional().default([]),
});
