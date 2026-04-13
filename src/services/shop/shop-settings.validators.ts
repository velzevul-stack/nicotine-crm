import { z } from 'zod';

export const patchShopSettingsSchema = z.object({
  defaultPostFormatId: z.string().nullable().optional(),
});
