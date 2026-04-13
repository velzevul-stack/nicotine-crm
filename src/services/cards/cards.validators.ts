import { z } from 'zod';

export const createCardSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateCardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
});
