
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

async function check() {
  try {
    const { AppDataSource } = await import('../lib/db/data-source');
    const {
      UserEntity,
      ShopEntity,
      CategoryEntity,
      BrandEntity,
      ProductFormatEntity,
      FlavorEntity,
      StockItemEntity,
    } = await import('../lib/db/entities');

    await AppDataSource.initialize();
    const ds = AppDataSource;

    console.log('--- Database Counts ---');
    console.log('Users:', await ds.getRepository(UserEntity).count());
    console.log('Shops:', await ds.getRepository(ShopEntity).count());
    console.log('Categories:', await ds.getRepository(CategoryEntity).count());
    console.log('Brands:', await ds.getRepository(BrandEntity).count());
    console.log('Formats:', await ds.getRepository(ProductFormatEntity).count());
    console.log('Flavors:', await ds.getRepository(FlavorEntity).count());
    console.log('StockItems:', await ds.getRepository(StockItemEntity).count());
    console.log('-----------------------');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Check failed:', error);
    process.exit(1);
  }
}

check();
