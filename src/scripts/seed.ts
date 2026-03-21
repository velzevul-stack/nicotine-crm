/**
 * Seed script: shop, inventory, demo sales/debts/cards/reservations/post format.
 * Run: npx tsx src/scripts/seed.ts
 */
import 'reflect-metadata';
import fs from 'fs';
import path from 'path';

console.log('Starting seed script...');

// Manual .env loading
const envPath = path.resolve(process.cwd(), '.env');
console.log('Looking for .env at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('.env file found. Loading variables...');
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      // Remove quotes if present
      const cleanValue = value.replace(/^["'](.*)["']$/, '$1');
      if (!process.env[key.trim()]) {
         process.env[key.trim()] = cleanValue;
      }
    }
  });
} else {
  console.log('.env file NOT found!');
}

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '******' : '(not set)');

/** Ключ доступа для тестового пользователя dev-user-1 — только из .env, не хранить в коде. */
function getDevSeedAccessKey(): string {
  const key = process.env.DEV_SEED_ACCESS_KEY?.trim();
  if (!key) {
    console.error(
      '\n❌ Не задан DEV_SEED_ACCESS_KEY в .env\n' +
        '   Добавьте строку: DEV_SEED_ACCESS_KEY=KEY-... или ваш ключ (как в личном кабинете).\n' +
        '   См. .env.example\n'
    );
    process.exit(1);
  }
  return key;
}

// Dynamic import to ensure env vars are loaded BEFORE AppDataSource is initialized
async function seed() {
  try {
    console.log('Importing entities...');
    const {
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
      CardEntity,
      UserStatsEntity,
      SystemSettingsEntity,
    } = await import('../lib/db/entities');
    
    console.log('Importing crypto utils...');
    const { generateReferralCode } = await import('../lib/utils/crypto');
    const {
      WENDIGO_ACCESS_KEY,
      isWendigoSuperadminUsername,
      applyWendigoSuperadminToUser,
    } = await import('../lib/superadmin-bootstrap');
    
    console.log('Importing DataSource...');
    const { DataSource } = await import('typeorm');

    // Create a DataSource with synchronize enabled for seed script
    console.log('Creating DataSource with synchronize...');
    const seedDataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'telegram_seller',
      synchronize: true, // Enable synchronize for seed script
      logging: false,
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
        CardEntity,
        UserStatsEntity,
        SystemSettingsEntity,
      ],
    });

    console.log('Initializing DataSource...');
    await seedDataSource.initialize();
    console.log('DataSource initialized successfully. Tables created/updated.');
    
    const ds = seedDataSource;

    const userRepo = ds.getRepository(UserEntity);
    const seedOwnerTg = process.env.SEED_OWNER_TELEGRAM_ID?.trim();

    let user = await userRepo.findOne({ where: { accessKey: WENDIGO_ACCESS_KEY } });
    if (!user) {
      user = await userRepo
        .createQueryBuilder('u')
        .where('LOWER(TRIM(u.username)) = :name', { name: 'wendigo2347' })
        .getOne();
    }
    if (!user && seedOwnerTg) {
      user = await userRepo.findOne({ where: { telegramId: seedOwnerTg } });
    }

    let devAccessKey: string | null = null;
    if (!user) {
      devAccessKey = getDevSeedAccessKey();
      user = await userRepo.findOne({
        where: [{ telegramId: 'dev-user-1' }, { accessKey: devAccessKey }],
      });
    }

    const isWendigoSeedTarget =
      !!user &&
      (user.accessKey === WENDIGO_ACCESS_KEY ||
        isWendigoSuperadminUsername(user.username) ||
        (!!seedOwnerTg && user.telegramId === seedOwnerTg));

    if (!user) {
      devAccessKey = devAccessKey ?? getDevSeedAccessKey();
      console.log('Creating dev user...');

      const trialEndsAt = new Date();
      trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 1);

      const referralCode = generateReferralCode();

      user = userRepo.create({
        telegramId: 'dev-user-1',
        firstName: 'Алексей',
        lastName: null,
        username: 'dev_seller',
        role: 'seller',
        accessKey: devAccessKey,
        subscriptionStatus: 'trial',
        trialEndsAt,
        referralCode,
        isActive: true,
      });
      await userRepo.save(user);
      console.log(`User created (dev-user-1), access key from DEV_SEED_ACCESS_KEY, length: ${devAccessKey.length}`);
    } else if (isWendigoSeedTarget) {
      let updated = false;
      if (await applyWendigoSuperadminToUser(userRepo, user)) updated = true;
      if (!user.referralCode) {
        user.referralCode = generateReferralCode();
        updated = true;
      }
      if (!user.trialEndsAt) {
        const trialEndsAt = new Date();
        trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 1);
        user.trialEndsAt = trialEndsAt;
        updated = true;
      }
      if (!user.subscriptionStatus) {
        user.subscriptionStatus = 'trial';
        updated = true;
      }
      if (user.isActive === undefined || user.isActive === null) {
        user.isActive = true;
        updated = true;
      }
      if (updated) {
        await userRepo.save(user);
        console.log('Seed target (wendigo / SEED_OWNER_TELEGRAM_ID): user fields updated');
      }
    } else {
      devAccessKey = devAccessKey ?? getDevSeedAccessKey();
      let updated = false;
      if (!user.accessKey || user.accessKey !== devAccessKey) {
        const conflictingUser = await userRepo.findOne({ where: { accessKey: devAccessKey } });
        if (conflictingUser && conflictingUser.id !== user.id) {
          conflictingUser.accessKey = null;
          await userRepo.save(conflictingUser);
        }
        user.accessKey = devAccessKey;
        updated = true;
      }
      if (!user.referralCode) {
        user.referralCode = generateReferralCode();
        updated = true;
      }
      if (!user.trialEndsAt) {
        const trialEndsAt = new Date();
        trialEndsAt.setFullYear(trialEndsAt.getFullYear() + 1);
        user.trialEndsAt = trialEndsAt;
        updated = true;
      }
      if (!user.subscriptionStatus) {
        user.subscriptionStatus = 'trial';
        updated = true;
      }
      if (user.isActive === undefined || user.isActive === null) {
        user.isActive = true;
        updated = true;
      }
      if (updated) {
        await userRepo.save(user);
        console.log('User fields updated');
      }
    }

    const shopRepo = ds.getRepository(ShopEntity);
    let shop = await shopRepo.findOne({ where: { ownerId: user.id } });
    if (!shop) {
      console.log('Creating shop...');
      shop = shopRepo.create({
        name: 'Мой магазин',
        timezone: 'Europe/Minsk',
        ownerId: user.id,
        currency: 'BYN',
        address: null,
      });
      await shopRepo.save(shop);
    }

    const userShopRepo = ds.getRepository(UserShopEntity);
    let us = await userShopRepo.findOne({
      where: { userId: user.id, shopId: shop.id },
    });
    if (!us) {
      us = userShopRepo.create({
        userId: user.id,
        shopId: shop.id,
        roleInShop: 'owner',
      });
      await userShopRepo.save(us);
    }

    const categoryRepo = ds.getRepository(CategoryEntity);
    const brandRepo = ds.getRepository(BrandEntity);
    const formatRepo = ds.getRepository(ProductFormatEntity);
    const flavorRepo = ds.getRepository(FlavorEntity);
    const stockRepo = ds.getRepository(StockItemEntity);

    // Categories
    const categoriesData = [
      { name: 'Жидкости', sortOrder: 1, emoji: '💨' },
      { name: 'Устройства', sortOrder: 2, emoji: '🔋' },
      { name: 'Расходники', sortOrder: 3, emoji: '🔧' },
      { name: 'Снюс', sortOrder: 4, emoji: '📦' },
      { name: 'Одноразки', sortOrder: 5, emoji: '🚬' }
    ];

    const categories = [];
    for (const c of categoriesData) {
      let cat = await categoryRepo.findOne({ where: { shopId: shop.id, name: c.name } });
      if (!cat) {
        cat = await categoryRepo.save(categoryRepo.create({ shopId: shop.id, ...c }));
      }
      categories.push(cat);
    }
    const [cat1, cat2, cat3, cat4, cat5] = categories;

    // Brands
    const brandsData = [
      { categoryId: cat1.id, name: 'PODONKI', emojiPrefix: '🤪' },
      { categoryId: cat1.id, name: 'CATSWILL', emojiPrefix: '🐱' },
      { categoryId: cat1.id, name: 'MALAYSIAN', emojiPrefix: '😱' },
      { categoryId: cat2.id, name: 'XROS', emojiPrefix: '⚡' },
      { categoryId: cat3.id, name: 'VAPORESSO', emojiPrefix: '🔥' },
      { categoryId: cat4.id, name: 'SIBERIA', emojiPrefix: '❄️' },
      { categoryId: cat4.id, name: 'ODENS', emojiPrefix: '🌲' },
      { categoryId: cat5.id, name: 'PUFF', emojiPrefix: '💨' },
      { categoryId: cat5.id, name: 'HQD', emojiPrefix: '⚡' }
    ];

    const brands = [];
    // Группируем бренды по категориям для правильной установки sortOrder
    const brandsByCategory = new Map<string, typeof brandsData>();
    for (const b of brandsData) {
      if (!brandsByCategory.has(b.categoryId)) {
        brandsByCategory.set(b.categoryId, []);
      }
      brandsByCategory.get(b.categoryId)!.push(b);
    }
    
    // Создаем бренды с правильным sortOrder для каждой категории
    for (const [categoryId, categoryBrands] of brandsByCategory.entries()) {
      let categorySortOrder = 1;
      for (const b of categoryBrands) {
        let brand = await brandRepo.findOne({ where: { shopId: shop.id, name: b.name, categoryId: b.categoryId } });
        if (!brand) {
          // Определяем максимальный sortOrder для этой категории
          const maxOrder = await brandRepo
            .createQueryBuilder('brand')
            .select('MAX(brand.sortOrder)', 'max')
            .where('brand.shopId = :shopId', { shopId: shop.id })
            .andWhere('brand.categoryId = :categoryId', { categoryId: b.categoryId })
            .getRawOne();
          const sortOrder = (maxOrder?.max ?? 0) + 1;
          
          brand = await brandRepo.save(brandRepo.create({ 
            shopId: shop.id, 
            ...b,
            sortOrder,
          }));
        } else {
          // Обновляем sortOrder если его нет или равен 0
          if (brand.sortOrder === undefined || brand.sortOrder === null || brand.sortOrder === 0) {
            const maxOrder = await brandRepo
              .createQueryBuilder('brand')
              .select('MAX(brand.sortOrder)', 'max')
              .where('brand.shopId = :shopId', { shopId: shop.id })
              .andWhere('brand.categoryId = :categoryId', { categoryId: b.categoryId })
              .getRawOne();
            brand.sortOrder = (maxOrder?.max ?? 0) + 1;
            await brandRepo.save(brand);
          }
        }
        brands.push(brand);
      }
    }
    const [br1, br2, br3, br4, br5, br6, br7, br8, br9] = brands;

    // Formats
    const formatsData = [
      { brandId: br1.id, name: 'PODONKI SOUR', strengthLabel: '50 mg', unitPrice: 15, isLiquid: true, isSnus: false, isDevice: false, isConsumable: false },
      { brandId: br1.id, name: 'PODONKI SWEET', strengthLabel: '30 mg', unitPrice: 15, isLiquid: true, isSnus: false, isDevice: false, isConsumable: false },
      { brandId: br2.id, name: 'CATSWILL EXTRA', strengthLabel: '50 mg', unitPrice: 18, isLiquid: true, isSnus: false, isDevice: false, isConsumable: false },
      { brandId: br3.id, name: 'MALAYSIAN ICE', strengthLabel: '20 mg', unitPrice: 12, isLiquid: true, isSnus: false, isDevice: false, isConsumable: false },
      { brandId: br4.id, name: 'XROS 5 MINI', strengthLabel: '', unitPrice: 45, isLiquid: false, isSnus: false, isDevice: true, isConsumable: false },
      { brandId: br5.id, name: 'GTX COIL 0.4', strengthLabel: '', unitPrice: 8, isLiquid: false, isSnus: false, isDevice: false, isConsumable: true },
      { brandId: br6.id, name: 'SIBERIA RED', strengthLabel: '43 mg', unitPrice: 25, isLiquid: false, isSnus: true, isDevice: false, isConsumable: false },
      { brandId: br6.id, name: 'SIBERIA BROWN', strengthLabel: '43 mg', unitPrice: 25, isLiquid: false, isSnus: true, isDevice: false, isConsumable: false },
      { brandId: br7.id, name: 'ODENS EXTREME', strengthLabel: '22 mg', unitPrice: 20, isLiquid: false, isSnus: true, isDevice: false, isConsumable: false },
      { brandId: br8.id, name: 'PUFF BAR', strengthLabel: '', unitPrice: 35, isLiquid: false, isSnus: false, isDevice: true, isConsumable: false },
      { brandId: br9.id, name: 'HQD CUVIE', strengthLabel: '', unitPrice: 30, isLiquid: false, isSnus: false, isDevice: true, isConsumable: false }
    ];

    const formats = [];
    for (const f of formatsData) {
      let fmt = await formatRepo.findOne({ where: { shopId: shop.id, name: f.name } });
      if (!fmt) {
        fmt = await formatRepo.save(formatRepo.create({ shopId: shop.id, ...f }));
      }
      formats.push(fmt);
    }
    const [pf1, pf2, pf3, pf4, pf5, pf6, pf7, pf8, pf9, pf10, pf11] = formats;

    const costForFormat = (unitPrice: number) =>
      Math.max(1, Math.round(Number(unitPrice) * 0.54));

    const flavorNames: [string, string][] = [
      ['pf1', 'ЛИМОНАД КИВИ КАКТУС'],
      ['pf1', 'МАНДАРИН СЛАДКОЕ ЯБЛОКО'],
      ['pf1', 'КЛУБНИКА БАНАН'],
      ['pf1', 'АНАНАС МАНГО'],
      ['pf1', 'ГРЕЙПФРУТ ЛИЧИ'],
      ['pf1', 'ЧЕРНИКА МАЛИНА'],
      ['pf2', 'ВИНОГРАД МЯТА'],
      ['pf2', 'ПЕРСИК ЛАЙМ'],
      ['pf2', 'ЯГОДЫ ЛЁД'],
      ['pf2', 'КОЛА ВИШНЯ'],
      ['pf3', 'ДЫНЯ АРБУЗ'],
      ['pf3', 'КОКОС ВАНИЛЬ'],
      ['pf3', 'МАЛИНА МОХИТО'],
      ['pf3', 'ЛИЧИ МЯТА'],
      ['pf4', 'ХОЛОДНЫЙ МАНГО'],
      ['pf4', 'ЛЕДЯНОЙ АРБУЗ'],
      ['pf4', 'ГУАВА ЛАЙМ'],
      ['pf5', 'Чёрный'],
      ['pf5', 'Серебро'],
      ['pf5', 'Розовый'],
      ['pf6', 'Стандарт'],
      ['pf6', 'Mesh 0.6'],
      ['pf7', 'Красный'],
      ['pf7', 'Синий'],
      ['pf8', 'Коричневый'],
      ['pf8', 'Белый'],
      ['pf9', 'Экстрим'],
      ['pf9', 'Cold Dry'],
      ['pf10', 'Мята'],
      ['pf10', 'Клубника'],
      ['pf10', 'Виноград'],
      ['pf11', 'Манго'],
      ['pf11', 'Арбуз'],
      ['pf11', 'Кола'],
    ];
    
    const pfMap: Record<string, any> = {
      pf1: pf1,
      pf2: pf2,
      pf3: pf3,
      pf4: pf4,
      pf5: pf5,
      pf6: pf6,
      pf7: pf7,
      pf8: pf8,
      pf9: pf9,
      pf10: pf10,
      pf11: pf11,
    };
    const baseQty = [
      18, 14, 12, 22, 16, 20, 10, 8, 24, 15, 20, 11, 9, 19, 14, 17, 13, 6, 5, 8, 40, 35, 28, 32, 24, 22, 38, 36, 16, 14, 12, 20, 18, 25,
    ];
    const quantities = baseQty.map((q, i) => q + ((i * 7) % 11));

    for (let i = 0; i < flavorNames.length; i++) {
      const [pfKey, name] = flavorNames[i];
      const format = pfMap[pfKey];
      const existing = await flavorRepo.findOne({
        where: { shopId: shop.id, productFormatId: format.id, name },
      });
      if (existing) continue;

      const flavor = await flavorRepo.save(
        flavorRepo.create({
          shopId: shop.id,
          productFormatId: format.id,
          name,
        })
      );
      const costPrice = costForFormat(format.unitPrice);
      let stock = await stockRepo.findOne({
        where: { shopId: shop.id, flavorId: flavor.id },
      });
      if (!stock) {
        stock = stockRepo.create({
          shopId: shop.id,
          flavorId: flavor.id,
          quantity: quantities[i] ?? 24,
          costPrice,
        });
        await stockRepo.save(stock);
      } else {
        stock.quantity = quantities[i] ?? stock.quantity;
        stock.costPrice = costPrice;
        await stockRepo.save(stock);
      }
    }

    const { seedShopDemoTransactions } = await import('./lib/seed-shop-demo-transactions');
    await seedShopDemoTransactions(ds, { shopId: shop.id, sellerId: user.id });

    console.log('Seed OK: shop', shop.id);
    await ds.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
