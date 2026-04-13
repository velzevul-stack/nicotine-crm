import { z } from 'zod';

export const updateFlavorSchema = z.object({
  name: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  costPrice: z.number().finite().min(0, { message: 'Себестоимость не может быть отрицательной' }).optional(),
  unitPrice: z.number().min(0).optional(),
});
