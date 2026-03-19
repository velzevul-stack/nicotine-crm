import type { DataSource } from 'typeorm';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
} from '../../lib/db/entities';

/**
 * Демо-склад для магазина (категории, бренды, форматы, вкусы, остатки).
 * Идемпотентно: не дублирует существующие сущности с теми же именами.
 */
export async function seedShopDemoInventory(ds: DataSource, shopId: string): Promise<void> {
  const categoryRepo = ds.getRepository(CategoryEntity);
  const brandRepo = ds.getRepository(BrandEntity);
  const formatRepo = ds.getRepository(ProductFormatEntity);
  const flavorRepo = ds.getRepository(FlavorEntity);
  const stockRepo = ds.getRepository(StockItemEntity);

  const categoriesData = [
    { name: 'Жидкости', sortOrder: 1, emoji: '💨' },
    { name: 'Устройства', sortOrder: 2, emoji: '🔋' },
    { name: 'Расходники', sortOrder: 3, emoji: '🔧' },
    { name: 'Снюс', sortOrder: 4, emoji: '📦' },
    { name: 'Одноразки', sortOrder: 5, emoji: '🚬' },
  ];

  const categories = [];
  for (const c of categoriesData) {
    let cat = await categoryRepo.findOne({ where: { shopId, name: c.name } });
    if (!cat) {
      cat = await categoryRepo.save(categoryRepo.create({ shopId, ...c }));
    }
    categories.push(cat);
  }
  const [cat1, cat2, cat3, cat4, cat5] = categories;

  const brandsData = [
    { categoryId: cat1.id, name: 'PODONKI', emojiPrefix: '🤪' },
    { categoryId: cat1.id, name: 'CATSWILL', emojiPrefix: '🐱' },
    { categoryId: cat1.id, name: 'MALAYSIAN', emojiPrefix: '😱' },
    { categoryId: cat2.id, name: 'XROS', emojiPrefix: '⚡' },
    { categoryId: cat3.id, name: 'VAPORESSO', emojiPrefix: '🔥' },
    { categoryId: cat4.id, name: 'SIBERIA', emojiPrefix: '❄️' },
    { categoryId: cat4.id, name: 'ODENS', emojiPrefix: '🌲' },
    { categoryId: cat5.id, name: 'PUFF', emojiPrefix: '💨' },
    { categoryId: cat5.id, name: 'HQD', emojiPrefix: '⚡' },
  ];

  const brands = [];
  const brandsByCategory = new Map<string, typeof brandsData>();
  for (const b of brandsData) {
    if (!brandsByCategory.has(b.categoryId)) {
      brandsByCategory.set(b.categoryId, []);
    }
    brandsByCategory.get(b.categoryId)!.push(b);
  }

  for (const [, categoryBrands] of brandsByCategory.entries()) {
    for (const b of categoryBrands) {
      let brand = await brandRepo.findOne({
        where: { shopId, name: b.name, categoryId: b.categoryId },
      });
      if (!brand) {
        const maxOrder = await brandRepo
          .createQueryBuilder('brand')
          .select('MAX(brand.sortOrder)', 'max')
          .where('brand.shopId = :shopId', { shopId })
          .andWhere('brand.categoryId = :categoryId', { categoryId: b.categoryId })
          .getRawOne();
        const sortOrder = (maxOrder?.max ?? 0) + 1;

        brand = await brandRepo.save(
          brandRepo.create({
            shopId,
            ...b,
            sortOrder,
          })
        );
      } else {
        if (brand.sortOrder === undefined || brand.sortOrder === null || brand.sortOrder === 0) {
          const maxOrder = await brandRepo
            .createQueryBuilder('brand')
            .select('MAX(brand.sortOrder)', 'max')
            .where('brand.shopId = :shopId', { shopId })
            .andWhere('brand.categoryId = :categoryId', { categoryId: b.categoryId })
            .getRawOne();
          brand.sortOrder = (maxOrder?.max ?? 0) + 1;
          await brandRepo.save(brand);
        }
      }
      brands.push(brand);
    }
  }
  const [br1, br2, br3, br4, br5, br6, br7, br8, br9] = brands;

  const formatsData = [
    { brandId: br1.id, name: 'PODONKI SOUR', strengthLabel: '50 mg', unitPrice: 15, isLiquid: true, isSnus: false, isDevice: false, isConsumable: false },
    { brandId: br1.id, name: 'PODONKI SWEET', strengthLabel: '30 mg', unitPrice: 15, isLiquid: true, isSnus: false, isDevice: false, isConsumable: false },
    { brandId: br2.id, name: 'CATSWILL EXTRA', strengthLabel: '50 mg', unitPrice: 18, isLiquid: true, isSnus: false, isDevice: false, isConsumable: false },
    { brandId: br3.id, name: 'MALAYSIAN ICE', strengthLabel: '20 mg', unitPrice: 12, isLiquid: true, isSnus: false, isDevice: false, isConsumable: false },
    { brandId: br4.id, name: 'XROS 5 MINI', strengthLabel: '', unitPrice: 45, isLiquid: false, isSnus: false, isDevice: true, isConsumable: false },
    { brandId: br5.id, name: 'GTX COIL 0.4', strengthLabel: '', unitPrice: 8, isLiquid: false, isSnus: false, isDevice: false, isConsumable: true },
    { brandId: br6.id, name: 'SIBERIA RED', strengthLabel: '43 mg', unitPrice: 25, isLiquid: false, isSnus: true, isDevice: false, isConsumable: false },
    { brandId: br6.id, name: 'SIBERIA BROWN', strengthLabel: '43 mg', unitPrice: 25, isLiquid: false, isSnus: true, isDevice: false, isConsumable: false },
    { brandId: br7.id, name: 'ODENS EXTREME', strengthLabel: '22 mg', unitPrice: 20, isLiquid: false, isSnus: true, isDevice: false, isConsumable: false },
    { brandId: br8.id, name: 'PUFF BAR', strengthLabel: '', unitPrice: 35, isLiquid: false, isSnus: false, isDevice: true, isConsumable: false },
    { brandId: br9.id, name: 'HQD CUVIE', strengthLabel: '', unitPrice: 30, isLiquid: false, isSnus: false, isDevice: true, isConsumable: false },
  ];

  const formats = [];
  for (const f of formatsData) {
    let fmt = await formatRepo.findOne({ where: { shopId, name: f.name } });
    if (!fmt) {
      fmt = await formatRepo.save(formatRepo.create({ shopId, ...f }));
    }
    formats.push(fmt);
  }
  const [pf1, pf2, pf3, pf4, pf5, pf6, pf7, pf8, pf9, pf10, pf11] = formats;

  const flavorNames: [string, string][] = [
    ['pf1', 'ЛИМОНАД КИВИ КАКТУС'],
    ['pf1', 'МАНДАРИН СЛАДКОЕ ЯБЛОКО'],
    ['pf1', 'КЛУБНИКА БАНАН'],
    ['pf1', 'АНАНАС МАНГО'],
    ['pf2', 'ВИНОГРАД МЯТА'],
    ['pf2', 'ПЕРСИК ЛАЙМ'],
    ['pf3', 'ДЫНЯ АРБУЗ'],
    ['pf3', 'КОКОС ВАНИЛЬ'],
    ['pf3', 'МАЛИНА МОХИТО'],
    ['pf4', 'ХОЛОДНЫЙ МАНГО'],
    ['pf4', 'ЛЕДЯНОЙ АРБУЗ'],
    ['pf5', 'Чёрный'],
    ['pf5', 'Серебро'],
    ['pf6', 'Стандарт'],
    ['pf7', 'Красный'],
    ['pf8', 'Коричневый'],
    ['pf9', 'Экстрим'],
    ['pf10', 'Мята'],
    ['pf10', 'Клубника'],
    ['pf11', 'Манго'],
    ['pf11', 'Арбуз'],
  ];

  const pfMap: Record<string, (typeof formats)[0]> = {
    pf1,
    pf2,
    pf3,
    pf4,
    pf5,
    pf6,
    pf7,
    pf8,
    pf9,
    pf10,
    pf11,
  };
  const quantities = [5, 3, 0, 7, 2, 4, 6, 1, 0, 8, 3, 2, 1, 12, 10, 8, 15, 6, 4, 9, 7];

  for (let i = 0; i < flavorNames.length; i++) {
    const [pfKey, name] = flavorNames[i];
    const format = pfMap[pfKey];
    const existing = await flavorRepo.findOne({
      where: { shopId, productFormatId: format.id, name },
    });
    if (existing) continue;

    const flavor = await flavorRepo.save(
      flavorRepo.create({
        shopId,
        productFormatId: format.id,
        name,
      })
    );
    let stock = await stockRepo.findOne({
      where: { shopId, flavorId: flavor.id },
    });
    if (!stock) {
      stock = stockRepo.create({
        shopId,
        flavorId: flavor.id,
        quantity: quantities[i] ?? 0,
        costPrice: 5,
      });
      await stockRepo.save(stock);
    } else {
      stock.quantity = quantities[i] ?? 0;
      await stockRepo.save(stock);
    }
  }
}
