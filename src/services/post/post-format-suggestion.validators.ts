import { z } from 'zod';

export const postFormatSuggestionSchema = z.object({
  text: z.string().min(10, 'Предложение должно содержать минимум 10 символов'),
});
