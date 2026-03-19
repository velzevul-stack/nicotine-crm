/**
 * Запуск миграций через tsx (обходит проблемы TypeORM CLI с ts-node).
 * Использование: npm run db:migrate
 *
 * Для пустой БД: сначала создаёт таблицы через synchronize, затем помечает
 * все миграции как выполненные (схема из entities уже актуальна).
 *
 * Здесь отдельный DataSource с путём к *.ts миграциям: в runtime Next.js
 * AppDataSource.migrations пустой, чтобы Node не пытался require() TypeScript.
 */
import 'dotenv/config';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { AppDataSource } from '../lib/db/data-source';

const MIGRATION_FILES = 'src/lib/db/migrations/*.ts';

function createMigrationDataSource(): DataSource {
  const base = AppDataSource.options as DataSourceOptions;
  return new DataSource({
    ...base,
    migrations: [MIGRATION_FILES],
    migrationsTableName: base.migrationsTableName ?? 'migrations',
  });
}

async function run() {
  const migrationDs = createMigrationDataSource();
  try {
    await migrationDs.initialize();

    const tablesExist = await migrationDs
      .query(
        `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      )`
      )
      .then((r: { exists: boolean }[]) => r[0]?.exists);

    if (!tablesExist) {
      console.log('Таблицы отсутствуют: создаём из entities через synchronize...');
      const tempDs = new DataSource({
        ...(migrationDs.options as DataSourceOptions),
        synchronize: true,
        migrations: [],
      });
      await tempDs.initialize();
      await tempDs.synchronize();
      await tempDs.destroy();
      console.log('Таблицы созданы.');
    }

    const migrationTableExists = await migrationDs
      .query(
        `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'migrations'
      )`
      )
      .then((r: { exists: boolean }[]) => r[0]?.exists);

    if (!migrationTableExists) {
      await migrationDs.query(`
        CREATE TABLE IF NOT EXISTS "migrations" (
          "id" SERIAL NOT NULL,
          "timestamp" bigint NOT NULL,
          "name" character varying NOT NULL,
          CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id")
        )
      `);
      const pendingMigrations = await migrationDs.getPendingMigrations();
      for (const m of pendingMigrations) {
        await migrationDs.query(
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
      const migrations = await migrationDs.runMigrations();
      console.log(
        migrations.length > 0
          ? `Выполнено миграций: ${migrations.length}`
          : 'Нет новых миграций для выполнения.'
      );
    }

    await migrationDs.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Ошибка миграции:', err);
    try {
      if (migrationDs.isInitialized) await migrationDs.destroy();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

run();
