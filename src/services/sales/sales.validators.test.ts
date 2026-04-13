import { describe, expect, it } from 'vitest';
import { createSaleSchema } from '@/services/sales/sales.validators';

const validUuid = '11111111-1111-4111-8111-111111111111';

describe('createSaleSchema', () => {
  it('accepts minimal cash sale', () => {
    const r = createSaleSchema.safeParse({
      paymentType: 'cash',
      items: [
        {
          flavorId: validUuid,
          productNameSnapshot: 'P',
          flavorNameSnapshot: 'F',
          unitPrice: 10,
          quantity: 1,
          lineTotal: 10,
        },
      ],
    });
    expect(r.success).toBe(true);
  });
  it('rejects empty items', () => {
    const r = createSaleSchema.safeParse({ paymentType: 'cash', items: [] });
    expect(r.success).toBe(false);
  });
});
