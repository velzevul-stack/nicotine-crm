/**
 * Скрипт для проверки accessKey в базе данных
 * Использование: npx tsx src/scripts/check-access-key.ts [accessKey]
 */
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

console.log('Starting check-access-key script...');

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

async function checkAccessKey() {
  try {
    const searchKey = process.argv[2];
    
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
    console.log('Connected to database\n');

    const userRepo = ds.getRepository(UserEntity);
    
    if (searchKey) {
      console.log(`Searching for key: ${searchKey}`);
      console.log(`Key length: ${searchKey.length}\n`);
      
      // Точное совпадение
      let user = await userRepo.findOne({
        where: { accessKey: searchKey },
      });
      
      if (user) {
        console.log('✅ Exact match found:');
        console.log(`   User ID: ${user.id}`);
        console.log(`   Telegram ID: ${user.telegramId}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Access Key length: ${user.accessKey?.length}`);
        console.log(`   Access Key: ${user.accessKey}`);
        console.log(`   Is Active: ${user.isActive}`);
      } else {
        console.log('❌ Exact match not found');
        
        // Case-insensitive поиск
        const caseInsensitiveUser = await userRepo
          .createQueryBuilder('user')
          .where('LOWER(user.accessKey) = LOWER(:key)', { key: searchKey })
          .getOne();
        
        if (caseInsensitiveUser) {
          console.log('\n✅ Case-insensitive match found:');
          console.log(`   User ID: ${caseInsensitiveUser.id}`);
          console.log(`   Telegram ID: ${caseInsensitiveUser.telegramId}`);
          console.log(`   Role: ${caseInsensitiveUser.role}`);
          console.log(`   Access Key length: ${caseInsensitiveUser.accessKey?.length}`);
          console.log(`   Access Key: ${caseInsensitiveUser.accessKey}`);
          console.log(`   Is Active: ${caseInsensitiveUser.isActive}`);
          console.log(`\n⚠️  Keys don't match exactly!`);
          console.log(`   Searched: ${searchKey}`);
          console.log(`   Found:    ${caseInsensitiveUser.accessKey}`);
        } else {
          console.log('❌ Case-insensitive match also not found');
        }
      }
    } else {
      console.log('All users:\n');
      const allUsers = await userRepo.find();
      
      if (allUsers.length === 0) {
        console.log('No users found');
      } else {
        allUsers.forEach((user, index) => {
          console.log(`${index + 1}. User ID: ${user.id}`);
          console.log(`   Telegram ID: ${user.telegramId}`);
          console.log(`   Role: ${user.role}`);
          console.log(`   Access Key: ${user.accessKey || '(не установлен)'}`);
          console.log(`   Access Key length: ${user.accessKey?.length || 0}`);
          console.log(`   Is Active: ${user.isActive}`);
          console.log('');
        });
      }
    }

    await ds.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAccessKey();
