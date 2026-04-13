import { getDataSource } from '@/lib/db/data-source';
import { CardEntity } from '@/lib/db/entities';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';
import { createCardSchema, updateCardSchema } from '@/services/cards/cards.validators';

export async function listCards(context: ShopContext) {
  const ds = await getDataSource();
  return ds.getRepository(CardEntity).find({
    where: { shopId: context.shopId },
    order: { sortOrder: 'ASC', name: 'ASC' },
  });
}

export async function createCard(context: ShopContext, body: unknown) {
  const parsed = createCardSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(CardEntity);

  const maxOrder = await repo
    .createQueryBuilder('c')
    .select('MAX(c.sortOrder)', 'max')
    .where('c.shopId = :shopId', { shopId: context.shopId })
    .getRawOne();

  const card = repo.create({
    shopId: context.shopId,
    name: parsed.data.name.trim(),
    sortOrder: (maxOrder?.max ?? 0) + 1,
  });
  return repo.save(card);
}

export async function updateCard(context: ShopContext, cardId: string, body: unknown) {
  const parsed = updateCardSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const repo = ds.getRepository(CardEntity);

  const card = await repo.findOne({
    where: { id: cardId, shopId: context.shopId },
  });

  if (!card) {
    throw new NotFoundError('Card not found');
  }

  if (parsed.data.name !== undefined) card.name = parsed.data.name.trim();
  if (parsed.data.sortOrder !== undefined) card.sortOrder = parsed.data.sortOrder;

  return repo.save(card);
}

export async function deleteCard(context: ShopContext, cardId: string) {
  const ds = await getDataSource();
  const repo = ds.getRepository(CardEntity);

  const card = await repo.findOne({
    where: { id: cardId, shopId: context.shopId },
  });

  if (!card) {
    throw new NotFoundError('Card not found');
  }

  await repo.remove(card);
  return { success: true as const };
}
