/**
 * Запуск миграций через tsx (обходит проблемы TypeORM CLI с ts-node).
 * Использование: npm run db:migrate
 */
import 'dotenv/config';
import { AppDataSource } from '../lib/db/data-source';

async function run() {
  try {
    await AppDataSource.initialize();
    const migrations = await AppDataSource.runMigrations();
    console.log(
      migrations.length > 0
        ? `Выполнено миграций: ${migrations.length}`
        : 'Нет новых миграций для выполнения.'
    );
    await AppDataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Ошибка миграции:', err);
    process.exit(1);
  }
}

run();
