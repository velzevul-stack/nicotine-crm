/**
 * Утилита для проверки и создания внешнего ключа для user_stats.userId
 * Вызывается автоматически при инициализации DataSource
 */
import { DataSource } from 'typeorm';

export async function ensureUserStatsForeignKey(ds: DataSource): Promise<void> {
  try {
    // Используем отдельное соединение из пула для последовательного выполнения запросов
    // чтобы избежать предупреждений о параллельных запросах
    const queryRunner = ds.createQueryRunner();
    await queryRunner.connect();
    
    try {
      // Проверяем существование таблицы
      const tableExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_stats'
        );
      `);

      if (!tableExists[0].exists) {
        // Таблица ещё не создана, TypeORM создаст её с правильным типом
        return;
      }

      // Проверяем тип колонки userId
      const columnInfo = await queryRunner.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stats' 
        AND column_name = 'userId';
      `);

      if (columnInfo.length === 0) {
        return; // Колонка не существует
      }

      const currentType = columnInfo[0].data_type;

      // Если тип character varying, исправляем на uuid
      if (currentType === 'character varying') {
        console.log('[ensureUserStatsForeignKey] Converting userId column from character varying to uuid...');
        
        // Удаляем внешний ключ если существует
        await queryRunner.query(`
          DO $$ 
          BEGIN
            IF EXISTS (
              SELECT 1 FROM pg_constraint 
              WHERE conname = 'FK_1ef59671d5359ff63ae55ae4efa'
            ) THEN
              ALTER TABLE "user_stats" DROP CONSTRAINT "FK_1ef59671d5359ff63ae55ae4efa";
            END IF;
          END $$;
        `);

        // Изменяем тип колонки
        await queryRunner.query(`
          ALTER TABLE "user_stats" 
          ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid;
        `);

        console.log('[ensureUserStatsForeignKey] ✅ Column type converted to uuid');
      }

      // Проверяем существование внешнего ключа
      const fkExists = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'FK_1ef59671d5359ff63ae55ae4efa'
        );
      `);

      if (!fkExists[0].exists) {
        console.log('[ensureUserStatsForeignKey] Creating foreign key constraint...');
        await queryRunner.query(`
          ALTER TABLE "user_stats" 
          ADD CONSTRAINT "FK_1ef59671d5359ff63ae55ae4efa" 
          FOREIGN KEY ("userId") REFERENCES "users"("id") 
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        `);
        console.log('[ensureUserStatsForeignKey] ✅ Foreign key created');
      }
    } finally {
      // Освобождаем соединение
      await queryRunner.release();
    }
  } catch (error) {
    // Не прерываем инициализацию при ошибке, просто логируем
    console.error('[ensureUserStatsForeignKey] Error:', error);
  }
}
