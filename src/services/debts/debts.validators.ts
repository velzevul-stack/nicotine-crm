import { z } from 'zod';

export const debtPaymentSchema = z.object({
  debtId: z.string().uuid(),
  amount: z.number().positive(),
  comment: z.string().nullable().default(null),
});
