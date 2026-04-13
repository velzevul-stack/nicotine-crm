import { z } from 'zod';

export const cancelReservationSchema = z.object({
  reservationId: z.string().uuid(),
});
