/**
 * Скрипт для назначения пользователя админом
 * Использование: npx tsx src/scripts/make-admin.ts <telegramId или accessKey>
 */
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

console.log('Starting make-admin script...');

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

async function makeAdmin() {
  try {
    const identifier = process.argv[2];
    if (!identifier) {
      console.error('Usage: npx tsx src/scripts/make-admin.ts <telegramId или accessKey>');
      console.error('Example: npx tsx src/scripts/make-admin.ts dev-user-1');
      console.error('Example: npx tsx src/scripts/make-admin.ts dev-secret-key-fe794b4df97be4570efb52f44b7d5ec599ec8751d212ce79');
      process.exit(1);
    }

    const { DataSource } = await import('typeorm');
    const { UserEntity } = await import('../lib/db/entities');

    const ds = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'telegram_seller',
      synchronize: false,
      logging: false,
      entities: [UserEntity],
    });

    await ds.initialize();
    console.log('Connected to database');

    const userRepo = ds.getRepository(UserEntity);
    
    // Ищем пользователя по telegramId или accessKey
    let user = await userRepo.findOne({
      where: [
        { telegramId: identifier },
        { accessKey: identifier },
      ],
    });

    if (!user) {
      console.error(`Пользователь не найден: ${identifier}`);
      console.log('\nДоступные пользователи:');
      const allUsers = await userRepo.find();
      allUsers.forEach((u) => {
        console.log(`  - telegramId: ${u.telegramId}, accessKey: ${u.accessKey}, role: ${u.role}`);
      });
      process.exit(1);
    }

    console.log(`Найден пользователь: ${user.telegramId || user.accessKey}`);
    console.log(`Текущая роль: ${user.role}`);
    console.log(`Access Key: ${user.accessKey || '(не установлен)'}`);
    console.log(`Access Key длина: ${user.accessKey?.length || 0}`);

    // Генерируем accessKey, если его нет
    if (!user.accessKey) {
      const { generateAccessKey } = await import('../lib/utils/crypto');
      user.accessKey = generateAccessKey();
      console.log(`\n⚠️  Access Key отсутствовал, сгенерирован новый: ${user.accessKey}`);
    }

    if (user.role === 'admin') {
      console.log('\nПользователь уже является админом!');
      // Сохраняем accessKey, если он был сгенерирован
      if (user.accessKey) {
        await userRepo.save(user);
        console.log('✅ Access Key сохранён');
      }
    } else {
      user.role = 'admin';
      user.subscriptionStatus = 'active';
      user.subscriptionEndsAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000); // 10 лет
      await userRepo.save(user);
      console.log('\n✅ Пользователь успешно назначен админом!');
      console.log(`   Роль: ${user.role}`);
      console.log(`   Подписка: ${user.subscriptionStatus} до ${user.subscriptionEndsAt?.toLocaleDateString('ru-RU')}`);
      console.log(`   Access Key: ${user.accessKey}`);
    }

    await ds.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

makeAdmin();
