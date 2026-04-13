import { z } from 'zod';

export const clientErrorBodySchema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(8000).optional(),
  href: z.string().max(2000).optional(),
  componentStack: z.string().max(4000).optional(),
  kind: z.enum(['runtime', 'boundary', 'unhandledrejection']).optional(),
});
