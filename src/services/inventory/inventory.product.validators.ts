import { z } from 'zod';
import { emptyToUndefined } from '@/services/inventory/inventory.shared';

export const createProductSchema = z.object({
  barcode: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional(),
  categoryName: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  brandId: z.string().uuid().optional(),
  brandName: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  brandEmoji: z.string().optional(),
  formatId: z.string().uuid().optional(),
  formatName: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  strengthLabel: z.string().optional(),
  ohmValue: z.string().optional(),
  resistanceValue: z.string().optional(),
  flavorName: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  costPrice: z.number().finite().min(0, { message: 'Себестоимость не может быть отрицательной' }),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(0).default(0),
  piecesPerPack: z.number().int().positive().optional(),
  packCost: z.number().finite().min(0).optional(),
  costPerPiece: z.number().finite().min(0).optional(),
  customValues: z.record(z.any()).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
