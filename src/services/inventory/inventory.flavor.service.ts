import { FlavorEntity, ProductFormatEntity, StockItemEntity } from '@/lib/db/entities';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { withTransaction } from '@/services/common/transaction';
import { PRICE_EPS, normalizeBarcode, normalizeName, normalizeNameKey } from '@/services/inventory/inventory.shared';
import { updateFlavorSchema } from '@/services/inventory/inventory.flavor.validators';

export async function updateFlavor(context: ShopContext, flavorId: string, body: unknown) {
  const parsed = updateFlavorSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  return withTransaction(async (em) => {
    const flavorRepo = em.getRepository(FlavorEntity);
    let flavor = await flavorRepo.findOne({
      where: { id: flavorId, shopId: context.shopId },
    });

    if (!flavor) {
      throw new NotFoundError('Flavor not found');
    }

    if (parsed.data.name !== undefined) {
      flavor.name = normalizeName(parsed.data.name);
      flavor.normalizedName = normalizeNameKey(parsed.data.name);
    }
    if (parsed.data.barcode !== undefined) {
      flavor.barcode = parsed.data.barcode
        ? normalizeBarcode(parsed.data.barcode)
        : parsed.data.barcode;
    }
    if (parsed.data.isActive !== undefined) flavor.isActive = parsed.data.isActive;

    const nextCostPrice = parsed.data.costPrice;
    const nextUnitPrice = parsed.data.unitPrice;
    if (nextCostPrice !== undefined || nextUnitPrice !== undefined) {
      const stockRepo = em.getRepository(StockItemEntity);
      const formatRepo = em.getRepository(ProductFormatEntity);
      const stock = await stockRepo.findOne({ where: { flavorId, shopId: context.shopId } });
      const format = await formatRepo.findOne({
        where: { id: flavor.productFormatId, shopId: context.shopId },
      });
      const effectiveCost = nextCostPrice ?? (stock?.costPrice ?? 0);
      const effectiveUnit = nextUnitPrice ?? (format?.unitPrice ?? 0);
      if (effectiveCost > effectiveUnit + PRICE_EPS) {
        throw new ValidationError('Себестоимость не может быть больше розничной цены', undefined, {
          code: 'COST_EXCEEDS_UNIT',
        });
      }
    }

    await flavorRepo.save(flavor);

    if (parsed.data.costPrice !== undefined) {
      const stockRepo = em.getRepository(StockItemEntity);
      let stock = await stockRepo.findOne({
        where: { flavorId, shopId: context.shopId },
      });

      if (!stock) {
        stock = stockRepo.create({
          shopId: context.shopId,
          flavorId,
          quantity: 0,
          costPrice: parsed.data.costPrice,
        });
      } else {
        stock.costPrice = parsed.data.costPrice;
      }
      await stockRepo.save(stock);
    }

    if (parsed.data.unitPrice !== undefined) {
      const formatRepo = em.getRepository(ProductFormatEntity);
      const format = await formatRepo.findOne({
        where: { id: flavor.productFormatId, shopId: context.shopId },
      });

      if (format) {
        format.unitPrice = parsed.data.unitPrice;
        await formatRepo.save(format);
      }
    }

    return { success: true as const };
  });
}

export async function deleteFlavor(context: ShopContext, flavorId: string) {
  return withTransaction(async (em) => {
    const flavorRepo = em.getRepository(FlavorEntity);
    const stockRepo = em.getRepository(StockItemEntity);

    const flavor = await flavorRepo.findOne({
      where: { id: flavorId, shopId: context.shopId },
    });

    if (!flavor) {
      throw new NotFoundError('Flavor not found');
    }

    const stockItem = await stockRepo.findOne({
      where: { flavorId, shopId: context.shopId },
    });

    if (stockItem && stockItem.quantity > 0) {
      throw new ValidationError(
        `Невозможно удалить вкус: на складе осталось ${stockItem.quantity} шт. Сначала продайте или списыте весь товар.`,
        undefined,
        { code: 'FLAVOR_HAS_STOCK' },
      );
    }

    if (stockItem) {
      await stockRepo.remove(stockItem);
    }

    await flavorRepo.remove(flavor);

    return { success: true as const };
  });
}
