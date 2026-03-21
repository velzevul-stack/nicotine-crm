import type { DataSource } from 'typeorm';
import type { User } from '@/lib/db/entities/User';
import type { Shop } from '@/lib/db/entities/Shop';
import { ShopEntity, UserShopEntity } from '@/lib/db/entities';
import { ensureDefaultCategoriesForShop } from '@/lib/db/ensure-default-categories';

/** Гарантирует магазин и связь UserShop; создаёт дефолтные категории. */
export async function ensureUserHasShop(ds: DataSource, user: User): Promise<Shop> {
  const shopRepo = ds.getRepository(ShopEntity);
  const userShopRepo = ds.getRepository(UserShopEntity);

  let userShop = await userShopRepo.findOne({
    where: { userId: user.id },
  });

  let shop: Shop | null = null;
  if (userShop) {
    shop = await shopRepo.findOne({ where: { id: userShop.shopId } });
  }

  if (!shop) {
    shop = shopRepo.create({
      name: 'Мой магазин',
      timezone: 'Europe/Minsk',
      ownerId: user.id,
      currency: 'BYN',
      address: null,
    });
    await shopRepo.save(shop);

    userShop = userShopRepo.create({
      userId: user.id,
      shopId: shop.id,
      roleInShop: 'owner',
    });
    await userShopRepo.save(userShop);
  } else if (!userShop) {
    userShop = userShopRepo.create({
      userId: user.id,
      shopId: shop.id,
      roleInShop: user.id === shop.ownerId ? 'owner' : 'seller',
    });
    await userShopRepo.save(userShop);
  }

  await ensureDefaultCategoriesForShop(ds, shop.id);
  return shop;
}
