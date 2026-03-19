import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
} from '@/lib/db/entities';

export async function POST(request: NextRequest) {
  // Отключено: загрузка демо-товаров доступна только через db:seed на сервере
  return NextResponse.json({ message: 'This endpoint is disabled. Use npm run db:seed instead.' }, { status: 403 });
  
  // Старый код оставлен для справки, но недоступен:
  /*
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await getDataSource();
  const shopId = session.shopId;

  // Check if shop already has data
  const categoryRepo = ds.getRepository(CategoryEntity);
  const count = await categoryRepo.count({ where: { shopId } });
  
  if (count > 0) {
    return NextResponse.json({ message: 'Shop already has data' }, { status: 400 });
  }

  const brandRepo = ds.getRepository(BrandEntity);
  const formatRepo = ds.getRepository(ProductFormatEntity);
  const flavorRepo = ds.getRepository(FlavorEntity);
  const stockRepo = ds.getRepository(StockItemEntity);

  // Categories
  const cat1 = await categoryRepo.save(
    categoryRepo.create({ shopId, name: 'Жидкости', sortOrder: 1, emoji: '💨' })
  );
  const cat2 = await categoryRepo.save(
    categoryRepo.create({ shopId, name: 'Устройства', sortOrder: 2, emoji: '🔋' })
  );
  const cat3 = await categoryRepo.save(
    categoryRepo.create({ shopId, name: 'Расходники', sortOrder: 3, emoji: '🔧' })
  );
  const cat4 = await categoryRepo.save(
    categoryRepo.create({ shopId, name: 'Снюс', sortOrder: 4, emoji: '📦' })
  );
  const cat5 = await categoryRepo.save(
    categoryRepo.create({ shopId, name: 'Одноразки', sortOrder: 5, emoji: '🚬' })
  );

  // Brands
  const br1 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat1.id, name: 'PODONKI', emojiPrefix: '🤪' })
  );
  const br2 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat1.id, name: 'CATSWILL', emojiPrefix: '🐱' })
  );
  const br3 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat1.id, name: 'MALAYSIAN', emojiPrefix: '😱' })
  );
  const br4 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat2.id, name: 'XROS', emojiPrefix: '⚡' })
  );
  const br5 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat3.id, name: 'VAPORESSO', emojiPrefix: '🔥' })
  );
  const br6 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat4.id, name: 'SIBERIA', emojiPrefix: '❄️' })
  );
  const br7 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat4.id, name: 'ODENS', emojiPrefix: '⚡' })
  );
  const br8 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat5.id, name: 'ELFBAR', emojiPrefix: '🧚' })
  );
  const br9 = await brandRepo.save(
    brandRepo.create({ shopId, categoryId: cat5.id, name: 'LOST MARY', emojiPrefix: '🌙' })
  );

  // Formats
  const pf1 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br1.id, name: 'PODONKI SOUR', strengthLabel: '50 mg', unitPrice: 15, isLiquid: true })
  );
  const pf2 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br1.id, name: 'PODONKI SWEET', strengthLabel: '30 mg', unitPrice: 15, isLiquid: true })
  );
  const pf3 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br2.id, name: 'CATSWILL EXTRA', strengthLabel: '50 mg', unitPrice: 18, isLiquid: true })
  );
  const pf4 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br3.id, name: 'MALAYSIAN ICE', strengthLabel: '20 mg', unitPrice: 12, isLiquid: true })
  );
  const pf5 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br4.id, name: 'XROS 5 MINI', strengthLabel: '', unitPrice: 45, isLiquid: false })
  );
  const pf6 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br5.id, name: 'GTX COIL 0.4', strengthLabel: '', unitPrice: 8, isLiquid: false })
  );
  const pf7 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br6.id, name: 'SIBERIA RED', strengthLabel: '43 mg', unitPrice: 25, isLiquid: false })
  );
  const pf8 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br7.id, name: 'ODENS EXTREME', strengthLabel: '22 mg', unitPrice: 20, isLiquid: false })
  );
  const pf9 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br8.id, name: 'ELFBAR BC5000', strengthLabel: '50 mg', unitPrice: 35, isLiquid: false })
  );
  const pf10 = await formatRepo.save(
    formatRepo.create({ shopId, brandId: br9.id, name: 'LOST MARY OS5000', strengthLabel: '50 mg', unitPrice: 32, isLiquid: false })
  );

  // Flavors & Stock
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
    ['pf7', 'Синий'],
    ['pf8', 'Белый'],
    ['pf8', 'Чёрный'],
    ['pf9', 'КИВИ ПАССИОНФРУТ'],
    ['pf9', 'ВОДНЫЙ ЛЕДЕНЕЦ'],
    ['pf9', 'КЛУБНИКА БАНАН'],
    ['pf10', 'БЛУ РАЗЗ'],
    ['pf10', 'МАНГО ПЕРСИК'],
    ['pf10', 'ВИНОГРАД'],
  ];
  
  const pfMap: Record<string, any> = { pf1, pf2, pf3, pf4, pf5, pf6, pf7, pf8, pf9, pf10 };
  const quantities = [5, 3, 0, 7, 2, 4, 6, 1, 0, 8, 3, 2, 1, 12, 10, 8, 15, 12, 6, 5, 7, 9, 8, 10];

  for (let i = 0; i < flavorNames.length; i++) {
    const [pfKey, name] = flavorNames[i];
    const format = pfMap[pfKey];
    
    const flavor = await flavorRepo.save(
      flavorRepo.create({
        shopId,
        productFormatId: format.id,
        name,
      })
    );
    
    await stockRepo.save(
      stockRepo.create({
        shopId,
        flavorId: flavor.id,
        quantity: quantities[i] ?? 0,
        costPrice: 5,
      })
    );
  }

  return NextResponse.json({ success: true });
  */
}
