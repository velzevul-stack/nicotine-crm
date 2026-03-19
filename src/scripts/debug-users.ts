
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

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

async function debug() {
  try {
    const { AppDataSource } = await import('../lib/db/data-source');
    const { UserEntity, ShopEntity, StockItemEntity } = await import('../lib/db/entities');

    await AppDataSource.initialize();
    const ds = AppDataSource;

    console.log('--- USERS ---');
    const users = await ds.getRepository(UserEntity).find();
    users.forEach(u => console.log(`User: ${u.username} (ID: ${u.id}, TG: ${u.telegramId})`));

    console.log('--- SHOPS ---');
    const shops = await ds.getRepository(ShopEntity).find();
    shops.forEach(s => console.log(`Shop: ${s.name} (ID: ${s.id}, Owner: ${s.ownerId})`));

    console.log('--- STOCK ---');
    const stock = await ds.getRepository(StockItemEntity).find();
    console.log(`Total stock items: ${stock.length}`);
    stock.slice(0, 5).forEach(s => console.log(`Stock: Shop ${s.shopId}, Flavor ${s.flavorId}, Qty ${s.quantity}`));

    await AppDataSource.destroy();
  } catch (error) {
    console.error(error);
  }
}

debug();
