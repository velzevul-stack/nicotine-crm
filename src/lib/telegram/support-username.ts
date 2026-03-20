import { DataSource } from 'typeorm';
import { ShopEntity, UserShopEntity } from '@/lib/db/entities';

/** Текст кнопки поддержки в reply keyboard главного меню (webhook и polling). */
export const TELEGRAM_REPLY_SUPPORT_BUTTON_TEXT = '💬 Поддержка';

export async function getSupportTelegramUsernameForUser(
  ds: DataSource,
  user: { id: string }
): Promise<string | null> {
  const userShopRepo = ds.getRepository(UserShopEntity);
  const shopRepo = ds.getRepository(ShopEntity);
  const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
  if (userShop) {
    const shop = await shopRepo.findOne({ where: { id: userShop.shopId } });
    if (shop?.supportTelegramUsername) return shop.supportTelegramUsername;
  }
  const firstShop = await shopRepo.findOne({ where: {} });
  return firstShop?.supportTelegramUsername ?? null;
}

export function supportUsernameToTelegramUrl(username: string | null | undefined): string | null {
  if (!username) return null;
  const u = username.replace('@', '').trim();
  return u ? `https://t.me/${u}` : null;
}
