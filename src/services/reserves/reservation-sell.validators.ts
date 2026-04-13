import { z } from 'zod';

export const sellReservationBodySchema = z
  .object({
    paymentType: z.enum(['cash', 'card', 'split', 'debt']).optional(),
    cashAmount: z.number().optional(),
    cardAmount: z.number().optional(),
    customerName: z.string().nullable().optional(),
  })
  .strict();
