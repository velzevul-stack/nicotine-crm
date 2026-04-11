import type { EntityManager } from 'typeorm';
import { In } from 'typeorm';
import {
  BrandEntity,
  CategoryEntity,
  FlavorEntity,
  ProductFormatEntity,
} from '@/lib/db/entities';

/** Категория «Расходники»: учёт на складе, postQuantity может быть 0. */
export function isConsumableCategoryName(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase();
  return n.includes('расходник') || n.includes('расходн') || n.includes('consumable');
}

/** flavorId → расходник по цепочке flavor → format → brand → category.name */
export async function buildConsumableFlavorIdSet(
  em: EntityManager,
  shopId: string,
  flavorIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = [...new Set(flavorIds)].filter(Boolean);
  if (ids.length === 0) return out;

  const flavors = await em.getRepository(FlavorEntity).find({
    where: { shopId, id: In(ids) },
  });
  const formatIds = [...new Set(flavors.map((f) => f.productFormatId))];
  if (formatIds.length === 0) return out;

  const formats = await em.getRepository(ProductFormatEntity).find({
    where: { shopId, id: In(formatIds) },
  });
  const brandIds = [...new Set(formats.map((f) => f.brandId))];
  const brands = await em.getRepository(BrandEntity).find({
    where: { shopId, id: In(brandIds) },
  });
  const catIds = [...new Set(brands.map((b) => b.categoryId))];
  const cats = await em.getRepository(CategoryEntity).find({
    where: { shopId, id: In(catIds) },
  });

  const catById = new Map(cats.map((c) => [c.id, c]));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const formatById = new Map(formats.map((f) => [f.id, f]));

  for (const f of flavors) {
    const fmt = formatById.get(f.productFormatId);
    const br = fmt ? brandById.get(fmt.brandId) : undefined;
    const cat = br ? catById.get(br.categoryId) : undefined;
    if (cat && isConsumableCategoryName(cat.name)) {
      out.add(f.id);
    }
  }
  return out;
}
