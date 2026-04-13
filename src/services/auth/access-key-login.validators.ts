import { z } from 'zod';

export const accessKeyLoginSchema = z.object({
  accessKey: z.string().min(5),
});
