import { z } from 'zod';
import { isSafePhotoUrl } from '@/lib/image-validate';

export const updateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  emojiPrefix: z.string().optional(),
  photoUrl: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v === null || v === undefined || isSafePhotoUrl(v), {
      message: 'photoUrl must be /uploads/brands/<uuid>.(jpg|jpeg|png|webp)',
    }),
  categoryId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
});

export const reorderTwoBrandsSchema = z.object({
  brandId1: z.string().uuid(),
  brandId2: z.string().uuid(),
  sortOrder1: z.number().int(),
  sortOrder2: z.number().int(),
});

export const reorderCategoryBrandsSchema = z.object({
  categoryId: z.string().uuid(),
  brandIds: z.array(z.string().uuid()),
});
