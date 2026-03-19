/**
 * Запуск миграций через tsx (обходит проблемы TypeORM CLI с ts-node).
 * Использование: npm run db:migrate
 *
 * Для пустой БД: сначала создаёт таблицы через synchronize, затем помечает
 * все миграции как выполненные (схема из entities уже актуальна).
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../lib/db/data-source';

async function run() {
  try {
    await AppDataSource.initialize();

    const migrationTableExists = await AppDataSource.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'migrations'
      )`
    ).then((r: { exists: boolean }[]) => r[0]?.exists);

    if (!migrationTableExists) {
      const tablesExist = await AppDataSource.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'users'
        )`
      ).then((r: { exists: boolean }[]) => r[0]?.exists);

      if (!tablesExist) {
        console.log('Пустая БД: создаём таблицы из entities...');
        const tempDs = new DataSource({
          ...AppDataSource.options,
          synchronize: true,
          migrations: [],
        });
        await tempDs.initialize();
        await tempDs.synchronize();
        await tempDs.destroy();
        console.log('Таблицы созданы.');
      }

      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS "migrations" (
          "id" SERIAL NOT NULL,
          "timestamp" bigint NOT NULL,
          "name" character varying NOT NULL,
          CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id")
        )
      `);
      const pendingMigrations = await AppDataSource.getPendingMigrations();
      for (const m of pendingMigrations) {
        await AppDataSource.query(
          `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`,
          [m.timestamp, m.name]
        );
      }
      console.log(
        pendingMigrations.length > 0
          ? `Помечено миграций как выполненных: ${pendingMigrations.length}`
          : 'Нет новых миграций для выполнения.'
      );
    } else {
      const migrations = await AppDataSource.runMigrations();
      console.log(
        migrations.length > 0
          ? `Выполнено миграций: ${migrations.length}`
          : 'Нет новых миграций для выполнения.'
      );
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Ошибка миграции:', err);
    process.exit(1);
  }
}

run();
