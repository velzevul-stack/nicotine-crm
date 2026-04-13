import { z } from 'zod';

const itemSchema = z.object({
  flavorId: z.string().uuid(),
  productNameSnapshot: z.string(),
  flavorNameSnapshot: z.string(),
  unitPrice: z.number(),
  quantity: z.number().int().min(1),
  lineTotal: z.number(),
});

const updateItemSchema = z.object({
  id: z.string().uuid().optional(),
  flavorId: z.string().uuid(),
  productNameSnapshot: z.string(),
  flavorNameSnapshot: z.string(),
  unitPrice: z.number(),
  quantity: z.number().int().min(1),
  lineTotal: z.number(),
});

export const createSaleSchema = z.object({
  paymentType: z.enum(['cash', 'card', 'split', 'debt']),
  cashAmount: z.number().min(0).optional(),
  cardAmount: z.number().min(0).optional(),
  cardId: z.string().uuid().nullable().optional(),
  discountValue: z.number().min(0).default(0),
  discountType: z.enum(['absolute', 'percent']).default('absolute'),
  comment: z.string().nullable().default(null),
  customerName: z.string().nullable().default(null),
  isReservation: z.boolean().default(false),
  reservationExpiry: z.preprocess(
    (val) => {
      if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
      if (typeof val === 'string') {
        try {
          const date = new Date(val);
          if (isNaN(date.getTime())) return null;
          return date.toISOString();
        } catch {
          return null;
        }
      }
      return null;
    },
    z.union([z.string().datetime(), z.null()]).optional(),
  ),
  reservationCustomerName: z.preprocess(
    (val) => (!val || val === '' || (typeof val === 'string' && val.trim() === '') ? null : val),
    z.string().nullable().optional(),
  ),
  saleDate: z.string().datetime().optional(),
  deliveryAmount: z.number().min(0).default(0),
  items: z.array(itemSchema).min(1),
});

export const updateSaleSchema = z.object({
  paymentType: z.enum(['cash', 'card', 'split', 'debt']).optional(),
  cashAmount: z.number().min(0).optional(),
  cardAmount: z.number().min(0).optional(),
  cardId: z.string().uuid().nullable().optional(),
  discountValue: z.number().min(0).optional(),
  discountType: z.enum(['absolute', 'percent']).optional(),
  comment: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  saleDate: z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)]).optional(),
  isReservation: z.boolean().optional(),
  reservationExpiry: z
    .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)])
    .nullable()
    .optional(),
  deliveryAmount: z.number().min(0).optional(),
  items: z.array(updateItemSchema).min(1).optional(),
});
