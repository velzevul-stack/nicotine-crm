/**
 * Назначить пользователя админом.
 *
 *   npx tsx src/scripts/make-admin.ts <telegramId | accessKey>
 *   npx tsx src/scripts/make-admin.ts --sole-admin <accessKey>
 *
 * --sole-admin — снять роль admin со всех остальных, оставить одного;
 *   для строки вида KEY-... ключ в БД приводится к верхнему регистру (как у generateAccessKey).
 */
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

import { accessKeySearchCandidates } from './lib/access-key-resolve';
import { In, type Repository } from 'typeorm';
import type { User } from '../lib/db/entities';

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

function looksLikeAccessKey(s: string): boolean {
  const t = s.trim();
  if (t.toUpperCase().startsWith('KEY-')) return true;
  return /^[0-9a-f]{64}$/i.test(t);
}

function normalizeAccessKey(input: string): string {
  const t = input.trim();
  const u = t.toUpperCase();
  if (u.startsWith('KEY-')) return u;
  return `KEY-${u}`;
}

function printUsage(): void {
  console.error('Использование:');
  console.error('  npx tsx src/scripts/make-admin.ts <telegramId или accessKey>');
  console.error('  npx tsx src/scripts/make-admin.ts --sole-admin <accessKey>');
  console.error('');
  console.error('Примеры:');
  console.error('  npx tsx src/scripts/make-admin.ts dev-user-1');
  console.error('  npx tsx src/scripts/make-admin.ts KEY-...');
  console.error('  npx tsx src/scripts/make-admin.ts --sole-admin KEY-...');
}

async function findUser(userRepo: Repository<User>, identifier: string) {
  const byTg = await userRepo.findOne({ where: { telegramId: identifier.trim() } });
  if (byTg) return byTg;

  const candidates = accessKeySearchCandidates(identifier);
  if (candidates.length === 0) return null;

  return userRepo.findOne({
    where: { accessKey: In(candidates) },
  });
}

async function makeAdmin() {
  const rawArgs = process.argv.slice(2);
  const soleAdmin = rawArgs.includes('--sole-admin');
  const identifier = rawArgs.filter((a) => a !== '--sole-admin')[0]?.trim();

  if (!identifier) {
    printUsage();
    process.exit(1);
  }

  try {
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
    console.log('Подключено к базе');

    const userRepo = ds.getRepository(UserEntity);

    let user = await findUser(userRepo, identifier);

    if (!user) {
      console.error('Пользователь не найден (проверьте telegramId или ключ, и что .env указывает на ту же БД, что и приложение).');
      console.log('\nПользователи (telegramId, роль, длина ключа):');
      const allUsers = await userRepo.find({ order: { createdAt: 'ASC' } });
      for (const u of allUsers) {
        const kl = u.accessKey?.length ?? 0;
        console.log(`  - ${u.telegramId}  role=${u.role}  keyLen=${kl}  active=${u.isActive}`);
      }
      await ds.destroy();
      process.exit(1);
    }

    if (soleAdmin && looksLikeAccessKey(identifier)) {
      const normalized = normalizeAccessKey(identifier);
      if (user.accessKey !== normalized) {
        const other = await userRepo.findOne({ where: { accessKey: normalized } });
        if (other && other.id !== user.id) {
          other.accessKey = null;
          await userRepo.save(other);
          console.log('Снят дублирующий ключ с другого пользователя');
        }
        user.accessKey = normalized;
      }
    } else if (!user.accessKey) {
      const { generateAccessKey } = await import('../lib/utils/crypto');
      user.accessKey = generateAccessKey();
      console.log('Ключ отсутствовал — сгенерирован новый (сохраните из вывода ниже)');
    }

    const others = await userRepo.find({ where: { role: 'admin' } });
    if (soleAdmin) {
      for (const u of others) {
        if (u.id === user.id) continue;
        u.role = 'seller';
        await userRepo.save(u);
        console.log(`Снята роль admin: ${u.telegramId}`);
      }
    }

    user.role = 'admin';
    user.isActive = true;
    user.subscriptionStatus = 'active';
    user.subscriptionEndsAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);

    await userRepo.save(user);

    console.log('');
    console.log('✅ Готово');
    console.log(`   telegramId: ${user.telegramId}`);
    console.log(`   роль: ${user.role}`);
    console.log(`   isActive: ${user.isActive}`);
    console.log(`   подписка: ${user.subscriptionStatus} до ${user.subscriptionEndsAt?.toLocaleDateString('ru-RU')}`);
    console.log(`   accessKey: ${user.accessKey}`);
    if (!soleAdmin && others.length > 1) {
      console.log('');
      console.log('(Другие admin в базе не трогались. Чтобы оставить одного: добавьте --sole-admin)');
    }

    await ds.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
}

makeAdmin();
