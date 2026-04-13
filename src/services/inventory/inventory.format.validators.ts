import { z } from 'zod';

export const updateProductFormatSchema = z.object({
  name: z.string().min(1).optional(),
  strengthLabel: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
  isLiquid: z.boolean().optional(),
  isActive: z.boolean().optional(),
  brandId: z.string().uuid().optional(),
});
