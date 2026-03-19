/**
 * Скрипт для исправления sortOrder у существующих брендов
 * Запуск: npx tsx src/scripts/fix-brand-sort-order.ts
 */
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

// Manual .env loading
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      const cleanValue = value.replace(/^["'](.*)["']$/, '$1');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = cleanValue;
      }
    }
  });
}

async function fixBrandSortOrder() {
  try {
    const { BrandEntity } = await import('../lib/db/entities');
    const { DataSource } = await import('typeorm');
    const { getDataSource } = await import('../lib/db/data-source');

    const ds = await getDataSource();
    const brandRepo = ds.getRepository(BrandEntity);

    // Получаем все бренды, сгруппированные по shopId и categoryId
    const allBrands = await brandRepo.find({
      order: { shopId: 'ASC', categoryId: 'ASC', createdAt: 'ASC' },
    });

    // Группируем по shopId и categoryId
    const brandsByShopAndCategory = new Map<string, typeof allBrands>();
    for (const brand of allBrands) {
      const key = `${brand.shopId}-${brand.categoryId}`;
      if (!brandsByShopAndCategory.has(key)) {
        brandsByShopAndCategory.set(key, []);
      }
      brandsByShopAndCategory.get(key)!.push(brand);
    }

    console.log(`Найдено ${allBrands.length} брендов в ${brandsByShopAndCategory.size} группах`);

    let updatedCount = 0;
    
    // Обновляем sortOrder для каждой группы
    for (const [key, brands] of brandsByShopAndCategory.entries()) {
      const [shopId, categoryId] = key.split('-');
      console.log(`\nОбработка группы: shopId=${shopId}, categoryId=${categoryId}, брендов: ${brands.length}`);
      
      // Сортируем по текущему sortOrder или createdAt
      brands.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      // Устанавливаем правильный sortOrder для каждого бренда
      for (let i = 0; i < brands.length; i++) {
        const brand = brands[i];
        const correctSortOrder = i + 1;
        
        if (brand.sortOrder !== correctSortOrder) {
          console.log(`  Обновление бренда "${brand.name}": ${brand.sortOrder || 0} -> ${correctSortOrder}`);
          brand.sortOrder = correctSortOrder;
          await brandRepo.save(brand);
          updatedCount++;
        }
      }
    }

    console.log(`\n✅ Обновлено ${updatedCount} брендов`);
    await ds.destroy();
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
}

fixBrandSortOrder();
