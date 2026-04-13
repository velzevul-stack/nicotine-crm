import { getDataSource } from '@/lib/db/data-source';
import { ShopEntity } from '@/lib/db/entities';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ServiceContext } from '@/services/common/service-context';
import { patchShopSettingsSchema } from '@/services/shop/shop-settings.validators';
import { updateShopSchema } from '@/services/shop/shop.validators';

export async function getShopOrCreateForSession(context: ServiceContext) {
  const ds = await getDataSource();
  const shopRepo = ds.getRepository(ShopEntity);
  let shop = await shopRepo.findOne({
    where: { id: context.shopId },
  });

  if (!shop) {
    let existingShop = await shopRepo.findOne({
      where: { ownerId: context.userId },
    });

    if (!existingShop) {
      shop = shopRepo.create({
        name: 'Мой магазин',
        timezone: 'Europe/Minsk',
        ownerId: context.userId,
        currency: 'BYN',
        address: null,
      });
      shop = await shopRepo.save(shop);
    } else {
      shop = existingShop;
    }
  }

  return shop;
}

export async function updateShop(context: ServiceContext, body: unknown) {
  const parsed = updateShopSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const shop = await ds.getRepository(ShopEntity).findOne({
    where: { id: context.shopId },
  });

  if (!shop) {
    throw new NotFoundError('Shop not found');
  }

  if (parsed.data.name !== undefined) shop.name = parsed.data.name;
  if (parsed.data.address !== undefined) shop.address = parsed.data.address;
  if (parsed.data.currency !== undefined) shop.currency = parsed.data.currency;
  if (parsed.data.timezone !== undefined) shop.timezone = parsed.data.timezone;
  if (parsed.data.supportTelegramUsername !== undefined) {
    shop.supportTelegramUsername = parsed.data.supportTelegramUsername;
  }
  if (parsed.data.country !== undefined) shop.country = parsed.data.country;
  if (parsed.data.city !== undefined) shop.city = parsed.data.city;
  if (parsed.data.region !== undefined) shop.region = parsed.data.region;

  await ds.getRepository(ShopEntity).save(shop);
  return shop;
}

export async function getShopPostFormatSettings(context: ServiceContext) {
  const ds = await getDataSource();
  const shop = await ds.getRepository(ShopEntity).findOne({
    where: { id: context.shopId },
  });

  if (!shop) {
    throw new NotFoundError('Shop not found');
  }

  return {
    defaultPostFormatId: shop.defaultPostFormatId || 'default',
  };
}

export async function updateShopPostFormatSettings(context: ServiceContext, body: unknown) {
  const parsed = patchShopSettingsSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const shopRepo = ds.getRepository(ShopEntity);
  const shop = await shopRepo.findOne({ where: { id: context.shopId } });

  if (!shop) {
    throw new NotFoundError('Shop not found');
  }

  const raw = parsed.data.defaultPostFormatId;
  shop.defaultPostFormatId = raw === 'default' ? null : raw || null;
  await shopRepo.save(shop);

  return {
    defaultPostFormatId: shop.defaultPostFormatId || 'default',
  };
}
