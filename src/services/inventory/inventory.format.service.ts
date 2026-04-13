import { BrandEntity, ProductFormatEntity } from '@/lib/db/entities';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';
import { updateProductFormatSchema } from '@/services/inventory/inventory.format.validators';

export async function updateProductFormat(context: ShopContext, formatId: string, body: unknown) {
  const parsed = updateProductFormatSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const formatRepo = em.getRepository(ProductFormatEntity);
    const format = await formatRepo.findOne({
      where: { id: formatId, shopId: context.shopId },
    });

    if (!format) {
      throw new NotFoundError('Format not found');
    }

    if (parsed.data.name !== undefined) format.name = parsed.data.name;
    if (parsed.data.strengthLabel !== undefined) {
      format.strengthLabel = parsed.data.strengthLabel.replace(/мг/gi, 'mg').trim();
    }
    if (parsed.data.unitPrice !== undefined) format.unitPrice = parsed.data.unitPrice;
    if (parsed.data.isLiquid !== undefined) format.isLiquid = parsed.data.isLiquid;
    if (parsed.data.isActive !== undefined) format.isActive = parsed.data.isActive;

    if (parsed.data.brandId !== undefined) {
      const brandRepo = em.getRepository(BrandEntity);
      const brand = await brandRepo.findOne({
        where: { id: parsed.data.brandId, shopId: context.shopId },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      format.brandId = parsed.data.brandId;
    }

    await formatRepo.save(format);

    return { success: true as const, format };
  });
}
