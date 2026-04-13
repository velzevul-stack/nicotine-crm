import { z } from 'zod';

export const categoryFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'select']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  sortOrder: z.number().int(),
  target: z.enum(['flavor_name', 'strength_label', 'custom']).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Название категории обязательно').max(100, 'Название слишком длинное'),
  emoji: z.string().max(10, 'Эмодзи слишком длинное').default('📦'),
  sortOrder: z.number().int().optional(),
  customFields: z.array(categoryFieldSchema).optional().default([]),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().max(10).optional(),
  sortOrder: z.number().int().optional(),
  customFields: z.array(categoryFieldSchema).optional(),
});
