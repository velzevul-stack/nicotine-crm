/**
 * Скрипт для очистки базы данных (удаление всех данных, но сохранение структуры таблиц)
 * Используйте для тестирования пустого состояния приложения
 * 
 * ВНИМАНИЕ: Этот скрипт удаляет ВСЕ данные из базы данных!
 * 
 * Запуск: npm run db:clear
 * или: tsx src/scripts/clear-db.ts
 */

import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

function loadEnvFromFile(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
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

async function clearDatabase() {
  console.log('⚠️  ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из базы данных!');
  console.log('Нажмите Ctrl+C для отмены или подождите 5 секунд...\n');

  await new Promise((resolve) => setTimeout(resolve, 5000));

  loadEnvFromFile();

  try {
    console.log('Импорт сущностей...');
    const {
      UserEntity,
      ShopEntity,
      UserShopEntity,
      CategoryEntity,
      BrandEntity,
      ProductFormatEntity,
      FlavorEntity,
      StockItemEntity,
      SaleEntity,
      SaleItemEntity,
      DebtEntity,
      DebtOperationEntity,
      PostFormatEntity,
      PostFormatSuggestionEntity,
      CardEntity,
      UserStatsEntity,
    } = await import('../lib/db/entities');
    
    console.log('Импорт DataSource...');
    const { DataSource } = await import('typeorm');

    // Создаем DataSource
    const dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'telegram_seller',
      synchronize: false, // Не синхронизируем, только удаляем данные
      logging: true,
      entities: [
        UserEntity,
        ShopEntity,
        UserShopEntity,
        CategoryEntity,
        BrandEntity,
        ProductFormatEntity,
        FlavorEntity,
        StockItemEntity,
        SaleEntity,
        SaleItemEntity,
        DebtEntity,
        DebtOperationEntity,
        PostFormatEntity,
        PostFormatSuggestionEntity,
        CardEntity,
        UserStatsEntity,
      ],
    });

    console.log('Подключение к базе данных...');
    await dataSource.initialize();
    console.log('✓ Подключено к базе данных\n');

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    console.log('Начало очистки данных...\n');

    try {
      await dataSource
        .getRepository(UserEntity)
        .createQueryBuilder()
        .update()
        .set({ referrerId: null })
        .where('1 = 1')
        .execute();
      console.log('✓ Сброшены self-FK users.referrerId (если были ссылки)\n');
    } catch (e: any) {
      console.warn('○ Не удалось сбросить referrerId (возможно, колонка отсутствует):', e?.message ?? e);
    }

    // Удаляем данные в правильном порядке (сначала зависимые таблицы)
    const tables = [
      { name: 'debt_operations', entity: DebtOperationEntity },
      { name: 'debts', entity: DebtEntity },
      { name: 'sale_items', entity: SaleItemEntity },
      { name: 'sales', entity: SaleEntity },
      { name: 'stock_items', entity: StockItemEntity },
      { name: 'flavors', entity: FlavorEntity },
      { name: 'product_formats', entity: ProductFormatEntity },
      { name: 'brands', entity: BrandEntity },
      { name: 'categories', entity: CategoryEntity },
      { name: 'post_format_suggestions', entity: PostFormatSuggestionEntity },
      { name: 'post_formats', entity: PostFormatEntity },
      { name: 'cards', entity: CardEntity },
      { name: 'user_shops', entity: UserShopEntity },
      { name: 'shops', entity: ShopEntity },
      { name: 'user_stats', entity: UserStatsEntity },
      { name: 'users', entity: UserEntity },
    ];

    const failedTables: string[] = [];
    for (const table of tables) {
      try {
        const repo = dataSource.getRepository(table.entity);
        const count = await repo.count();
        if (count > 0) {
          await repo.clear();
          console.log(`✓ Очищена таблица ${table.name} (${count} записей)`);
        } else {
          console.log(`○ Таблица ${table.name} уже пуста`);
        }
      } catch (error: any) {
        console.error(`✗ Ошибка при очистке ${table.name}:`, error.message);
        failedTables.push(table.name);
      }
    }

    const usersLeft = await dataSource.getRepository(UserEntity).count();
    if (usersLeft > 0) {
      console.error(`\n✗ Таблица users не очищена полностью: осталось ${usersLeft} записей`);
      failedTables.push('users(verify)');
    }

    if (failedTables.length > 0) {
      console.error('\n❌ Очистка завершилась с ошибками:', failedTables.join(', '));
      await queryRunner.release();
      await dataSource.destroy();
      process.exit(1);
    }

    console.log('\n✓ Очистка базы данных завершена!');
    console.log('\nТеперь вы можете:');
    console.log('1. Запустить приложение: npm run dev');
    console.log('2. Войти через /login (создастся новый пользователь)');
    console.log('3. Протестировать пустое состояние приложения');
    console.log('\nДля заполнения тестовыми данными используйте: npm run db:seed');

    await queryRunner.release();
    await dataSource.destroy();
  } catch (error: any) {
    console.error('Ошибка при очистке базы данных:', error);
    process.exit(1);
  }
}

clearDatabase().catch((err) => {
  console.error(err);
  process.exit(1);
});
