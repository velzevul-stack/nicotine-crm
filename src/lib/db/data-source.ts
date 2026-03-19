import 'reflect-metadata';
// import 'dotenv/config'; // Load .env file
import { DataSource } from 'typeorm';
import {
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
  UserStatsEntity,
  SystemSettingsEntity,
  CardEntity,
} from './entities/index';
import { ensureUserStatsForeignKey } from './ensure-user-stats-fk';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'telegram_seller',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
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
    UserStatsEntity,
    SystemSettingsEntity,
    CardEntity,
  ],
  migrations: ['src/lib/db/migrations/*.ts'],
  migrationsTableName: 'migrations',
  extra: {
    // Connection pool settings для pg драйвера
    // Предотвращает параллельные запросы на одном соединении
    max: 20, // Максимум соединений в пуле
    min: 2,  // Минимум соединений в пуле
    idleTimeoutMillis: 30000, // Таймаут для неактивных соединений (30 секунд)
    connectionTimeoutMillis: 10000, // Таймаут для установки соединения (10 секунд)
    // Важно: каждый запрос должен использовать отдельное соединение из пула
    statement_timeout: 20000, // Таймаут для выполнения запросов (20 секунд)
    query_timeout: 20000, // Таймаут для запросов (20 секунд)
    // Гарантируем, что каждое соединение используется только для одного запроса за раз
    allowExitOnIdle: false, // Не закрывать соединения при простое
  },
});

let connectionPromise: Promise<DataSource> | null = null;

export async function getDataSource(): Promise<DataSource> {
  // Если уже инициализирован, возвращаем сразу
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  // Если уже идет инициализация, ждем её завершения
  if (connectionPromise) {
    return connectionPromise;
  }

  // Создаем промис инициализации только один раз
  connectionPromise = Promise.race([
    AppDataSource.initialize()
      .then(async (ds) => {
        // После инициализации ждем завершения всех операций синхронизации
        // и только потом проверяем и исправляем внешний ключ для user_stats
        // Используем setTimeout для отложенного выполнения, чтобы синхронизация точно завершилась
        await new Promise(resolve => setTimeout(resolve, 100));
        await ensureUserStatsForeignKey(ds);
        return ds;
      }),
    // Таймаут на случай зависания инициализации
    new Promise<DataSource>((_, reject) => 
      setTimeout(() => reject(new Error('DataSource initialization timeout after 30 seconds')), 30000)
    )
  ])
    .catch(async (error: any) => {
      // Если ошибка связана с внешним ключом user_stats, пытаемся исправить
      if (
        error?.code === '42804' &&
        error?.message?.includes('user_stats') &&
        error?.message?.includes('userId')
      ) {
        console.log('[getDataSource] Foreign key error detected, attempting to fix...');
        try {
          // Создаём временное соединение для исправления
          const tempDs = new DataSource({
            type: 'postgres',
            host: process.env.DB_HOST ?? 'localhost',
            port: parseInt(process.env.DB_PORT ?? '5432', 10),
            username: process.env.DB_USER ?? 'postgres',
            password: process.env.DB_PASSWORD ?? 'postgres',
            database: process.env.DB_NAME ?? 'telegram_seller',
            synchronize: false,
            logging: false,
            entities: [],
          });
          await tempDs.initialize();
          await ensureUserStatsForeignKey(tempDs);
          await tempDs.destroy();
          
          // Пытаемся инициализировать снова
          console.log('[getDataSource] Retrying initialization after fix...');
          connectionPromise = null; // Сбрасываем промис для повторной попытки
          return getDataSource();
        } catch (fixError) {
          console.error('[getDataSource] Failed to fix foreign key:', fixError);
          connectionPromise = null;
          throw error; // Выбрасываем оригинальную ошибку
        }
      }
      // При другой ошибке сбрасываем промис и выбрасываем ошибку
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
}
