import { z } from 'zod';

export const updateShopSchema = z.object({
  name: z.string().optional(),
  address: z.string().nullable().optional(),
  currency: z.enum(['BYN', 'USD', 'RUB']).optional(),
  timezone: z.string().optional(),
  supportTelegramUsername: z.string().nullable().optional(),
  country: z.enum(['RU', 'BY']).nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
});
