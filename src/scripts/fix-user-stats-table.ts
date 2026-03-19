/**
 * Скрипт для исправления таблицы user_stats
 * Удаляет таблицу с неправильным типом userId и позволяет TypeORM пересоздать её
 */
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

console.log('Starting fix-user-stats-table script...');

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

async function fixTable() {
  try {
    const { DataSource } = await import('typeorm');

    const ds = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'telegram_seller',
      synchronize: false,
      logging: true,
      entities: [],
    });

    await ds.initialize();
    console.log('Connected to database');

    // Удаляем таблицу user_stats если она существует
    await ds.query('DROP TABLE IF EXISTS "user_stats" CASCADE;');
    console.log('✅ Table user_stats dropped successfully');

    // Проверяем, что таблица удалена
    const result = await ds.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stats'
      );
    `);
    console.log('Table exists:', result[0].exists);

    await ds.destroy();
    console.log('✅ Done! Now restart the application and TypeORM will recreate the table with correct types.');
    console.log('⚠️  Make sure to clear Next.js cache: Remove-Item -Recurse -Force .next');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixTable();
