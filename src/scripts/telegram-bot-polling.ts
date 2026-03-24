/**
 * Скрипт для запуска Telegram бота в режиме long polling (для локальной разработки)
 * 
 * Использование: npm run bot:polling
 * 
 * ВАЖНО: Этот скрипт используется только для локальной разработки.
 * В production используйте webhook через API route.
 * 
 * РЕФАКТОРИНГ: Код разделен на модули для улучшения читаемости и поддержки
 */

import dotenv from 'dotenv';
import { Telegraf, Context } from 'telegraf';
import { Client } from 'pg';
import { DataSource, IsNull } from 'typeorm';
import { UserEntity, PostFormatEntity, UserShopEntity } from '@/lib/db/entities';
import {
  ShopEntity,
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
  SaleEntity,
  SaleItemEntity,
  DebtEntity,
  DebtOperationEntity,
  PostFormatSuggestionEntity,
} from '@/lib/db/entities';
import { generateAccessKey, generateReferralCode } from '@/lib/utils/crypto';
import {
  applyWendigoSuperadminToUser,
  isWendigoTarget,
} from '@/lib/superadmin-bootstrap';
import { renderTemplate, PostData, CategoryData, BrandData, FormatData, FlavorData, ShopData, FormatConfig } from '@/lib/post/template-renderer';
import { generateStockTable } from '@/lib/excel/table-generator';
import { sendTelegramDocument } from '@/lib/telegram/send-document';
import { isSameDay } from 'date-fns';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Импорты модулей
import { handleProfile, handleRoleSwitch, confirmRoleSwitch } from './bot/commands/profile';
import { handleSubscription, handleBuySubscription } from './bot/commands/subscription';
import { handleReferrals, handleCopyReferralLink } from './bot/commands/referrals';
import { getMainMenuKeyboard } from './bot/keyboards/main-menu';
import { getProfileKeyboard } from './bot/keyboards/profile';
import {
  getSupportTelegramUsernameForUser,
  supportUsernameToTelegramUrl,
  TELEGRAM_REPLY_SUPPORT_BUTTON_TEXT,
} from '@/lib/telegram/support-username';
import {
  TELEGRAM_INFO_CHANNEL_INTRO,
  TELEGRAM_INFO_CHANNEL_REPLY_BUTTON,
  TELEGRAM_INFO_CHANNEL_URL,
  infoChannelMessageFooter,
} from '@/lib/telegram/info-channel';
import { getSubscriptionKeyboard } from './bot/keyboards/subscription';
import { getOnboardingKeyboard } from './bot/keyboards/onboarding';
import { setupErrorHandler } from './bot/utils/error-handler';

// Загружаем переменные окружения из .env файла (с перезаписью существующих)
dotenv.config({ override: true });

// Проверяем необходимые переменные окружения
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не установлен в .env файле');
  process.exit(1);
}

// Проверяем переменные для подключения к БД
const dbHost = (process.env.DB_HOST || 'localhost').trim();
const dbPort = (process.env.DB_PORT || '5432').trim();
const dbUser = (process.env.DB_USER || 'postgres').trim();
const dbPassword = process.env.DB_PASSWORD ? process.env.DB_PASSWORD.trim() : null;
const dbName = (process.env.DB_NAME || 'telegram_seller').trim();

if (!dbPassword) {
  console.error('❌ Ошибка: DB_PASSWORD не установлен в .env файле');
  console.error('💡 Убедитесь, что в файле .env указан правильный пароль для PostgreSQL');
  console.error('   Пример: DB_PASSWORD=ваш_пароль');
  console.error('   Если пароль содержит спецсимволы, заключите его в кавычки: DB_PASSWORD="ваш_пароль"');
  process.exit(1);
}

// Диагностика: показываем параметры подключения (пароль замаскирован)
const maskedPassword = dbPassword.length > 0 
  ? '*'.repeat(Math.min(dbPassword.length, 10)) + (dbPassword.length > 10 ? '...' : '')
  : '(пустой)';
console.log(`📊 Подключение к БД: ${dbUser}@${dbHost}:${dbPort}/${dbName}`);
console.log(`   Пароль: ${maskedPassword} (длина: ${dbPassword.length} символов)`);

// Создаём DataSource с явными параметрами подключения
const dataSource = new DataSource({
  type: 'postgres',
  host: dbHost,
  port: parseInt(dbPort, 10),
  username: dbUser,
  password: dbPassword,
  database: dbName,
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
  ],
  migrations: ['src/lib/db/migrations/*.ts'],
  migrationsTableName: 'migrations',
  extra: {
    // Параметры пула соединений
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
    // Явно передаём параметры подключения для pg драйвера
    host: dbHost,
    port: parseInt(dbPort, 10),
    user: dbUser,
    password: dbPassword,
    database: dbName,
  },
});

// Функция для получения DataSource
async function getDataSource(): Promise<DataSource> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  return dataSource;
}

const bot = new Telegraf(botToken);

// Добавляем middleware для логирования всех обновлений и проверки окончания триала
bot.use(async (ctx, next) => {
  const updateType = ctx.updateType;
  const userId = ctx.from?.id;
  
  if (updateType === 'message' && 'text' in ctx.message) {
    console.log(`[Bot] Update received: message "${ctx.message.text}" from user ${userId}`);
  } else if (updateType === 'callback_query') {
    console.log(`[Bot] Update received: callback_query "${ctx.callbackQuery.data}" from user ${userId}`);
  } else {
    console.log(`[Bot] Update received: ${updateType} from user ${userId}`);
  }
  
  try {
    await next();
    
    // После обработки обновления проверяем окончание триала (только для сообщений от пользователя)
    if (userId && (updateType === 'message' || updateType === 'callback_query')) {
      const telegramId = String(userId);
      // Выполняем асинхронно, не блокируя ответ
      checkAndSendTrialEndNotification(telegramId, userId).catch(err => {
        console.error(`[Trial End Notification] Background check failed:`, err);
      });
    }
  } catch (error: any) {
    console.error(`[Bot] Error in middleware for update ${updateType}:`, error);
    throw error;
  }
});

// Состояние выбора роли (в памяти, для MVP достаточно)
// TODO: Заменить на нормальные сессии (telegraf-session-local или Redis)
const roleSelectionState = new Map<number, { role: 'seller' | 'client'; referrerCode?: string }>();

// Состояние создания формата
interface FormatCreationState {
  step: 'name' | 'template' | 'config';
  name?: string;
  template?: string;
  config?: {
    showFlavors?: boolean;
    showPrices?: boolean;
    showStock?: boolean;
    showCategories?: boolean;
  };
}

const formatCreationState = new Map<number, FormatCreationState>();

// Состояние для генерации поста
interface PostGenerationState {
  selectedFormatIds: Set<string>;
  selectedPostFormatId: string | null;
  filters: {
    selectedCategories: string[];
    selectedBrands: string[];
    selectedStrengths: string[];
    selectedColors: string[];
  };
  page: number; // для пагинации форматов
}

const postGenerationState = new Map<number, PostGenerationState>();

// Состояние для массовой рассылки (только для админа)
const ADMIN_USERNAME = 'wendigo2347';
const broadcastState = new Map<number, { 
  waitingForMessage: boolean; 
  waitingForPhoto?: boolean;
  photoFileId?: string;
  caption?: string;
}>();

// Функция для проверки и отправки Loss Aversion уведомления при окончании триала
async function checkAndSendTrialEndNotification(telegramId: string, userId: number): Promise<void> {
  try {
    const ds = await getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { telegramId } });

    if (!user || user.subscriptionStatus !== 'trial' || !user.trialEndsAt) {
      return;
    }

    const now = new Date();
    const trialEndDate = new Date(user.trialEndsAt);

    // Проверяем, заканчивается ли триал сегодня
    if (isSameDay(trialEndDate, now)) {
      // Loss Aversion сообщение
      const message = `⚠️ Ваш пробный период заканчивается сегодня!\n\n` +
        `🎁 Вы использовали Post Stock Pro бесплатно в течение 14 дней.\n\n` +
        `💔 Не теряйте доступ к:\n` +
        `• 📝 Генерации красивых постов\n` +
        `• 📊 Управлению остатками\n` +
        `• 💰 Отслеживанию продаж и долгов\n` +
        `• 📈 Детальной аналитике\n\n` +
        `💳 Продолжите пользоваться всеми возможностями всего за 1000 ⭐ (≈ $10) в месяц!\n\n` +
        `Используйте команду /subscribe для покупки подписки.`;

      await bot.telegram.sendMessage(userId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Купить подписку', callback_data: 'subscription_buy_pro' }],
            [{ text: '👤 Мой профиль', callback_data: 'profile_subscription' }],
          ],
        },
      });

      console.log(`[Trial End Notification] Sent Loss Aversion notification to user ${user.id} (${telegramId})`);
    }
  } catch (error: any) {
    console.error(`[Trial End Notification] Error checking trial end for user ${telegramId}:`, error);
    // Не прерываем выполнение, если уведомление не удалось отправить
  }
}

// Функция для показа меню генерации поста (сохранена из оригинального кода)
async function showPostMenu(ctx: any, userId: number, userShopId: string) {
  const ds = await getDataSource();
  
  const [categories, brands, formats, flavors, stocks, postFormats] = await ds.transaction(async (em) => {
    const categoryRepo = em.getRepository(CategoryEntity);
    const brandRepo = em.getRepository(BrandEntity);
    const formatRepo = em.getRepository(ProductFormatEntity);
    const flavorRepo = em.getRepository(FlavorEntity);
    const stockRepo = em.getRepository(StockItemEntity);
    const postFormatRepo = em.getRepository(PostFormatEntity);

    return Promise.all([
      categoryRepo.find({
        where: { shopId: userShopId },
        order: { sortOrder: 'ASC' },
      }),
      brandRepo.find({ 
        where: { shopId: userShopId },
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      formatRepo.find({
        where: { shopId: userShopId, isActive: true },
      }),
      flavorRepo.find({
        where: { shopId: userShopId, isActive: true },
      }),
      stockRepo.find({ where: { shopId: userShopId } }),
      postFormatRepo.find({
        where: [
          { isActive: true, shopId: IsNull() },
          { isActive: true, shopId: userShopId },
        ],
        order: { createdAt: 'DESC' },
      }),
    ]);
  });

  const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));

  // Фильтруем форматы - показываем только те, у которых есть остатки
  const filteredFormats = formats.filter((f) => {
    const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
    return formatFlavors.some((flavor) => {
      const stock = stockMap.get(flavor.id);
      return stock && stock.quantity > 0;
    });
  });

  // Получаем или создаем состояние
  let state = postGenerationState.get(userId);
  if (!state) {
    state = {
      selectedFormatIds: new Set(filteredFormats.map((f) => f.id)),
      selectedPostFormatId: null,
      filters: {
        selectedCategories: [],
        selectedBrands: [],
        selectedStrengths: [],
        selectedColors: [],
      },
      page: 0,
    };
    postGenerationState.set(userId, state);
  }

  // Применяем фильтры
  let displayFormats = filteredFormats.filter((pf) => {
    const brand = brands.find((b) => b.id === pf.brandId);
    if (!brand) return false;
    
    if (state.filters.selectedCategories.length > 0 && !state.filters.selectedCategories.includes(brand.categoryId)) {
      return false;
    }
    if (state.filters.selectedBrands.length > 0 && !state.filters.selectedBrands.includes(brand.id)) {
      return false;
    }
    if (state.filters.selectedStrengths.length > 0) {
      const strength = (pf.strengthLabel || '').replace(/мг/gi, 'mg').trim();
      if (!state.filters.selectedStrengths.includes(strength)) {
        return false;
      }
    }
    return true;
  });

  // Пагинация
  const formatsPerPage = 10;
  const totalPages = Math.ceil(displayFormats.length / formatsPerPage);
  const startIdx = state.page * formatsPerPage;
  const pageFormats = displayFormats.slice(startIdx, startIdx + formatsPerPage);

  // Строим клавиатуру
  const keyboard: any[][] = [];

  // Выбор формата поста
  keyboard.push([{ text: '📋 Выбрать формат поста', callback_data: 'post_select_format' }]);
  
  // Текущий выбранный формат
  const selectedPostFormat = state.selectedPostFormatId 
    ? postFormats.find((f) => f.id === state.selectedPostFormatId)
    : null;
  if (selectedPostFormat) {
    keyboard.push([{ text: `✅ Формат: ${selectedPostFormat.name}`, callback_data: 'post_select_format' }]);
  } else {
    keyboard.push([{ text: '✅ Формат: Стандартный', callback_data: 'post_select_format' }]);
  }

  keyboard.push([]); // Разделитель

  // Фильтры
  const hasActiveFilters = state.filters.selectedCategories.length > 0 ||
    state.filters.selectedBrands.length > 0 ||
    state.filters.selectedStrengths.length > 0;
  
  keyboard.push([
    { text: '🔍 Фильтры' + (hasActiveFilters ? ' ✓' : ''), callback_data: 'post_filters' },
    { text: '✅ Выбрать всё', callback_data: 'post_select_all' },
    { text: '❌ Снять всё', callback_data: 'post_deselect_all' },
  ]);

  keyboard.push([]); // Разделитель

  // Список форматов с чекбоксами
  pageFormats.forEach((pf) => {
    const brand = brands.find((b) => b.id === pf.brandId);
    if (!brand) return;
    
    const isSelected = state.selectedFormatIds.has(pf.id);
    const flavorCount = flavors.filter(
      (f) => f.productFormatId === pf.id && (stockMap.get(f.id)?.quantity ?? 0) > 0
    ).length;
    
    const buttonText = `${isSelected ? '✅' : '☐'} ${brand.emojiPrefix || ''} ${pf.name} (${flavorCount} вкусов)`;
    keyboard.push([{ 
      text: buttonText.length > 60 ? buttonText.substring(0, 57) + '...' : buttonText, 
      callback_data: `post_toggle_format_${pf.id}` 
    }]);
  });

  // Навигация по страницам
  if (totalPages > 1) {
    const navRow: any[] = [];
    if (state.page > 0) {
      navRow.push({ text: '◀️ Назад', callback_data: 'post_page_prev' });
    }
    navRow.push({ text: `${state.page + 1}/${totalPages}`, callback_data: 'post_page_info' });
    if (state.page < totalPages - 1) {
      navRow.push({ text: 'Вперёд ▶️', callback_data: 'post_page_next' });
    }
    keyboard.push(navRow);
  }

  keyboard.push([]); // Разделитель

  // Кнопки действий
  keyboard.push([
    { text: '👁️ Предпросмотр', callback_data: 'post_preview' },
    { text: '📝 Сгенерировать', callback_data: 'post_generate' },
    { text: '📊 Excel', callback_data: 'post_excel' },
  ]);

  const selectedCount = Array.from(state.selectedFormatIds).filter(id => 
    displayFormats.some(f => f.id === id)
  ).length;

  // Проверяем, есть ли данные для поста
  if (displayFormats.length === 0) {
    const message = `📝 Генератор поста\n\n` +
      `❌ Нет товаров в наличии.\n\n` +
      `Для генерации поста необходимо:\n` +
      `• Добавить товары в базу\n` +
      `• Указать остатки на складе\n\n` +
      `Используйте веб-приложение для управления товарами и остатками.`;
    
    const emptyKeyboard: any[][] = [
      [{ text: '◀️ Назад в меню', callback_data: 'back_to_menu' }],
    ];
    
    return { message, keyboard: emptyKeyboard };
  }

  const message = `📝 Генератор поста\n\n` +
    `Выбрано форматов: ${selectedCount} из ${displayFormats.length}\n` +
    `Формат поста: ${selectedPostFormat ? selectedPostFormat.name : 'Стандартный'}\n` +
    (hasActiveFilters ? `\n🔍 Активны фильтры\n` : '') +
    `\nВыберите форматы для включения в пост:`;

  return { message, keyboard };
}

// Функция для моментальной генерации и отправки поста
async function generateAndSendPostImmediately(ctx: any, userId: number, userShopId: string) {
  console.log(`[generateAndSendPostImmediately] Called for userId: ${userId}, shopId: ${userShopId}`);
  const ds = await getDataSource();
  
  const loadingMsg = await ctx.reply('⏳ Генерирую пост...');
  
  try {
    const [categories, brands, formats, flavors, stocks, shop, postFormats] = await ds.transaction(async (em) => {
      const categoryRepo = em.getRepository(CategoryEntity);
      const brandRepo = em.getRepository(BrandEntity);
      const formatRepo = em.getRepository(ProductFormatEntity);
      const flavorRepo = em.getRepository(FlavorEntity);
      const stockRepo = em.getRepository(StockItemEntity);
      const shopRepo = em.getRepository(ShopEntity);
      const postFormatRepo = em.getRepository(PostFormatEntity);

      return Promise.all([
        categoryRepo.find({ where: { shopId: userShopId }, order: { sortOrder: 'ASC' } }),
        brandRepo.find({ where: { shopId: userShopId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
        formatRepo.find({ where: { shopId: userShopId, isActive: true } }),
        flavorRepo.find({ where: { shopId: userShopId, isActive: true } }),
        stockRepo.find({ where: { shopId: userShopId } }),
        shopRepo.findOne({ where: { id: userShopId } }),
        postFormatRepo.find({
          where: [
            { isActive: true, shopId: IsNull() },
            { isActive: true, shopId: userShopId },
          ],
          order: { createdAt: 'DESC' },
        }),
      ]);
    });

    const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));

    // Фильтруем форматы - показываем только те, у которых есть остатки
    const filteredFormats = formats.filter((f) => {
      const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
      return formatFlavors.some((flavor) => {
        const stock = stockMap.get(flavor.id);
        return stock && stock.quantity > 0;
      });
    });

    // Проверяем, есть ли данные для поста
    console.log(`[generateAndSendPostImmediately] filteredFormats.length: ${filteredFormats.length}, formats.length: ${formats.length}, stocks.length: ${stocks.length}`);
    
    if (filteredFormats.length === 0) {
      try {
        if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {
        console.error('Error deleting loading message:', e);
      }
      
      // Проверяем, есть ли вообще товары в базе
      const hasAnyProducts = formats.length > 0;
      const hasAnyStock = stocks.some(s => s.quantity > 0);
      
      console.log(`[generateAndSendPostImmediately] hasAnyProducts: ${hasAnyProducts}, hasAnyStock: ${hasAnyStock}`);
      
      if (!hasAnyProducts) {
        await ctx.reply('❌ У вас пока нет товаров в базе.\n\nДобавьте товары через веб-приложение, чтобы генерировать посты.');
      } else if (!hasAnyStock) {
        await ctx.reply('❌ У вас нет товаров в наличии.\n\nОбновите остатки через веб-приложение, чтобы генерировать посты.');
      } else {
        await ctx.reply('❌ Нет товаров в наличии по выбранным критериям.\n\nПроверьте остатки и настройки фильтров в веб-приложении.');
      }
      return;
    }

    // Получаем формат поста: используем формат, выбранный в мини-апке (из настроек магазина)
    let template: string;
    let formatConfig: FormatConfig = {};
    
    // Получаем сохраненный формат поста из настроек магазина
    const defaultPostFormatId = shop?.defaultPostFormatId;
    
    if (defaultPostFormatId) {
      // Ищем формат по ID из настроек магазина
      const selectedFormat = postFormats.find(f => f.id === defaultPostFormatId);
      
      if (selectedFormat && selectedFormat.template) {
        // Используем формат, выбранный в мини-апке
        template = selectedFormat.template;
        formatConfig = (selectedFormat.config as FormatConfig) || {
          showFlavors: true,
          showPrices: true,
          showStock: false,
          showCategories: true,
        };
        console.log('[generateAndSendPostImmediately] Using format from shop settings:', selectedFormat.name);
      } else {
        // Формат не найден, используем стандартный
        template = `📦⚡️Доставка от 5 до 20 минут⚡️📦
❗️ТОЛЬКО НАЛИЧКА❗️

{content}`;
        formatConfig = {
          showFlavors: true,
          showPrices: true,
          showStock: false,
          showCategories: true,
        };
        console.log('[generateAndSendPostImmediately] Format not found, using default template');
      }
    } else {
      // Используем стандартный формат по умолчанию (как на сайте, когда выбран "Стандартный")
      template = `📦⚡️Доставка от 5 до 20 минут⚡️📦
❗️ТОЛЬКО НАЛИЧКА❗️

{content}`;
      formatConfig = {
        showFlavors: true,
        showPrices: true,
        showStock: false,
        showCategories: true,
      };
      console.log('[generateAndSendPostImmediately] Using default template (no format selected in shop settings)');
    }

    // Используем все форматы с остатками (как на сайте, где всё включено)
    const formatIds = new Set(filteredFormats.map((f) => f.id));
    
    console.log('[generateAndSendPostImmediately] Building categoriesData...');
    console.log('[generateAndSendPostImmediately] Categories count:', categories.length);
    console.log('[generateAndSendPostImmediately] Brands count:', brands.length);
    console.log('[generateAndSendPostImmediately] Filtered formats count:', filteredFormats.length);

    const categoriesData: CategoryData[] = [];

    for (const cat of categories) {
      const catBrands = brands.filter((b) => b.categoryId === cat.id);
      const brandsData: BrandData[] = [];

      for (const brand of catBrands) {
        const bFormats = filteredFormats.filter(
          (f) => f.brandId === brand.id && formatIds.has(f.id)
        );
        const formatsData: FormatData[] = [];

        for (const format of bFormats) {
          const fFlavors = flavors
            .filter((f) => f.productFormatId === format.id)
            .map((f) => {
              const stock = stockMap.get(f.id);
              return {
                id: f.id,
                name: f.name,
                stock: stock?.quantity ?? 0,
              } as FlavorData;
            })
            .filter((f) => f.stock > 0);

          if (fFlavors.length === 0 && formatConfig.showFlavors !== false) {
            continue;
          }

          formatsData.push({
            id: format.id,
            name: format.name,
            price: format.unitPrice,
            strength: format.strengthLabel || undefined,
            flavors: fFlavors,
          });
        }

        if (formatsData.length > 0) {
          brandsData.push({
            id: brand.id,
            name: brand.name,
            emojiPrefix: brand.emojiPrefix || '',
            formats: formatsData,
          });
        }
      }

      if (brandsData.length > 0) {
        categoriesData.push({
          id: cat.id,
          name: cat.name,
          emoji: cat.emoji || '📦',
          brands: brandsData,
        });
      }
    }
    
    console.log('[generateAndSendPostImmediately] Built categoriesData:', categoriesData.length, 'categories');
    if (categoriesData.length > 0) {
      console.log('[generateAndSendPostImmediately] First category:', categoriesData[0].name, 'with', categoriesData[0].brands.length, 'brands');
    }

    const shopData: ShopData | undefined = shop
      ? {
          name: shop.name,
          address: shop.address || undefined,
        }
      : undefined;

    const postData: PostData = {
      categories: categoriesData,
      shop: shopData,
    };

    console.log('[generateAndSendPostImmediately] Template:', template.substring(0, 100));
    console.log('[generateAndSendPostImmediately] Categories count:', categoriesData.length);
    console.log('[generateAndSendPostImmediately] Format config:', formatConfig);
    
    const postText = renderTemplate(template, postData, formatConfig);
    
    console.log('[generateAndSendPostImmediately] Rendered post text length:', postText?.length || 0);
    console.log('[generateAndSendPostImmediately] Rendered post text (first 200 chars):', postText?.substring(0, 200) || '(empty)');

    try {
      if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    } catch (e) {}

    if (!postText || postText.trim().length === 0) {
      console.log('[generateAndSendPostImmediately] Post text is empty, categoriesData:', JSON.stringify(categoriesData, null, 2));
      await ctx.reply('❌ Не удалось сгенерировать пост.\n\nВозможные причины:\n• Нет товаров в наличии\n• Неправильная настройка формата поста\n\nПроверьте остатки и настройки в веб-приложении.');
      return;
    }

    // Отправляем пост напрямую как обычное сообщение
    console.log('[generateAndSendPostImmediately] Sending post, length:', postText.length);
    await ctx.reply(postText);
    console.log('[generateAndSendPostImmediately] Post sent successfully');
    // НЕ показываем меню после генерации поста - просто отправляем пост
    return;
  } catch (error) {
    console.error('[generateAndSendPostImmediately] Error generating post:', error);
    try {
      if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    } catch (e) {
      console.error('[generateAndSendPostImmediately] Error deleting loading message:', e);
    }
    await ctx.reply('❌ Ошибка при генерации поста.\n\nПопробуйте позже или обратитесь в поддержку.');
  }
}

async function mainMenuKeyboardForUser(
  ds: DataSource,
  user: { id: string; role: 'seller' | 'client' | 'admin' }
) {
  const support = await getSupportTelegramUsernameForUser(ds, user);
  return getMainMenuKeyboard(user.role, support);
}

// ==================== КОМАНДЫ ====================

// Команда /start - использует новый модуль
bot.command('start', async (ctx) => {
  console.log('[Bot] /start command received from user:', ctx.from.id);
  const telegramId = String(ctx.from.id);
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || null;
  const lastName = ctx.from.last_name || null;
  
  // Получаем реферальный код из start_param
  const startParam = ctx.message && 'text' in ctx.message 
    ? ctx.message.text.split(' ').slice(1)[0] 
    : undefined;

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  let user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    // Новый пользователь - показываем онбординг с баннером
    console.log('[Bot] New user detected, showing onboarding keyboard');
    let referrerId: string | null = null;
    if (startParam) {
      const referrer = await userRepo.findOne({ where: { referralCode: startParam } });
      if (referrer && referrer.id !== telegramId) {
        referrerId = referrer.id;
        console.log('[Bot] Referral code found:', startParam);
      }
    }

    // Сохраняем состояние с реферальным кодом
    roleSelectionState.set(ctx.from.id, { 
      role: 'seller', // По умолчанию, будет обновлено при выборе
      referrerCode: referrerId ? startParam : undefined 
    });

    const referralMessage = referrerId 
      ? '\n\n🎁 Вы перешли по реферальной ссылке! При покупке подписки ваш пригласивший получит бесплатный месяц.'
      : '';

    const welcomeText = `👋 Добро пожаловать в Post Stock Pro!

Это ваш личный ассистент для управления продажами и покупками.

🚀 Для продавцов: Создавайте красивые посты, управляйте наличием и форматами в пару кликов.
🛍 Для клиентов: Следите за любимыми магазинами и актуальным наличием.

👇 Чтобы начать, выберите, как вы хотите использовать бота:${referralMessage}

*Роль можно сменить в любой момент в профиле*${infoChannelMessageFooter()}`;

    const keyboard = getOnboardingKeyboard();
    console.log('[Bot] Sending welcome message with keyboard:', JSON.stringify(keyboard, null, 2));
    
    try {
      await ctx.reply(welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      console.log('[Bot] Welcome message sent successfully');
    } catch (error: any) {
      console.error('[Bot] Error sending welcome message:', error);
      console.error('[Bot] Error details:', error.message, error.stack);
      // Пытаемся отправить без Markdown
      try {
        await ctx.reply(welcomeText.replace(/\*/g, ''), {
          reply_markup: keyboard,
        });
      } catch (e: any) {
        console.error('[Bot] Error sending welcome message without Markdown:', e);
      }
    }
    
    return;
  }

  let needUserSave = false;
  if (username !== null && username !== undefined && user.username !== username) {
    user.username = username;
    needUserSave = true;
  }
  if (await applyWendigoSuperadminToUser(userRepo, user)) needUserSave = true;
  if (needUserSave) await userRepo.save(user);

  // Существующий пользователь - показываем приветствие и меню
  console.log('[Bot] Existing user detected:', user.telegramId, 'role:', user.role);
  const trialInfo = user.trialEndsAt
    ? `\nПробный период до: ${new Date(user.trialEndsAt).toLocaleDateString('ru-RU')}`
    : '';
  const subscriptionInfo =
    user.subscriptionStatus === 'active' && user.subscriptionEndsAt
      ? `\nПодписка активна до: ${new Date(user.subscriptionEndsAt).toLocaleDateString('ru-RU')}`
      : user.subscriptionStatus === 'expired'
        ? '\n⚠️ Подписка истекла'
        : '';

  const roleText = user.role === 'seller' 
    ? 'Продавец' 
    : user.role === 'client' 
      ? 'Клиент' 
      : 'Администратор';

  const menuKeyboard = await mainMenuKeyboardForUser(ds, user);
  console.log('[Bot] Sending greeting message with menu keyboard');
  
  try {
    await ctx.reply(
      `Привет, ${firstName || 'пользователь'}! 👋\n\n` +
        `Ваша роль: ${roleText}\n` +
        `Статус подписки: ${user.subscriptionStatus === 'trial' ? 'Пробный период' : user.subscriptionStatus === 'active' ? 'Активна' : 'Истекла'}` +
        trialInfo +
        subscriptionInfo +
        infoChannelMessageFooter(),
      { reply_markup: menuKeyboard }
    );
    console.log('[Bot] Greeting message sent successfully');
  } catch (error: any) {
    console.error('[Bot] Error sending greeting message:', error);
    console.error('[Bot] Error details:', error.message, error.stack);
  }
});

// Команда /menu
bot.command('menu', async (ctx) => {
  console.log('[Bot] /menu command received from user:', ctx.from.id);
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  await ctx.reply('📱 Главное меню:', { reply_markup: await mainMenuKeyboardForUser(ds, user) });
});

// Команда /broadcast - массовая рассылка (только для админа @wendigo2347)
bot.command('broadcast', async (ctx) => {
  console.log('[Bot] /broadcast command received from user:', ctx.from.id, 'username:', ctx.from.username);
  const telegramId = String(ctx.from.id);
  const username = ctx.from.username || null;

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  // Проверяем username из Telegram или из базы данных
  const userUsername = username || user.username;
  console.log('[Bot] Checking admin access:', { telegramUsername: username, dbUsername: user.username, adminUsername: ADMIN_USERNAME });

  // Проверяем, что это админ
  if (userUsername !== ADMIN_USERNAME) {
    console.log('[Bot] Access denied for /broadcast:', { userId: ctx.from.id, username: userUsername });
    await ctx.reply(`❌ У вас нет прав для выполнения этой команды.\n\nВаш username: ${userUsername || 'не установлен'}\nТребуется: @${ADMIN_USERNAME}`);
    return;
  }

  // Устанавливаем состояние ожидания сообщения
  broadcastState.set(ctx.from.id, { waitingForMessage: true });
  console.log('[Bot] Broadcast state set for user:', ctx.from.id);

  await ctx.reply(
    '📢 Массовая рассылка\n\n' +
    'Отправьте сообщение или фото с подписью, которое хотите разослать всем пользователям бота.\n\n' +
    'Используйте /cancel для отмены.'
  );
});

// Команда /cancel - отмена массовой рассылки
bot.command('cancel', async (ctx) => {
  const broadcast = broadcastState.get(ctx.from.id);
  if (broadcast && broadcast.waitingForMessage) {
    broadcastState.delete(ctx.from.id);
    await ctx.reply('❌ Массовая рассылка отменена.');
  }
});

// Команда для обновления клавиатуры
bot.command('updatekeyboard', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });
  const reply_markup = user
    ? await mainMenuKeyboardForUser(ds, user)
    : getMainMenuKeyboard();

  await ctx.reply('📱 Обновляю клавиатуру...', { reply_markup });
});

// Обработка выбора роли (обновлено для использования новых модулей)
bot.action(/^role_(seller|client)$/, async (ctx) => {
  const role = ctx.match[1] as 'seller' | 'client';
  console.log('[Bot] Callback: role_', role, 'from user:', ctx.from.id);
  const telegramId = String(ctx.from.id);
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || null;
  const lastName = ctx.from.last_name || null;

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  // Проверяем, не существует ли уже пользователь
  let user = await userRepo.findOne({ where: { telegramId } });
  if (user) {
    console.log('[Bot] User already exists, cannot change role via onboarding');
    await ctx.answerCbQuery('Вы уже зарегистрированы!');
    await ctx.editMessageText('Вы уже зарегистрированы в системе. Используйте /role для смены роли.');
    return;
  }

  // Получаем состояние с реферальным кодом
  const state = roleSelectionState.get(ctx.from.id);
  let referrerId: string | null = null;
  
  if (state?.referrerCode) {
    const referrer = await userRepo.findOne({ where: { referralCode: state.referrerCode } });
    if (referrer) {
      referrerId = referrer.id;
    }
  }

  // Создаем пользователя
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 дней триала

  const accessKey = generateAccessKey();
  const referralCode = generateReferralCode();

  user = userRepo.create({
    telegramId,
    username,
    firstName,
    lastName,
    role,
    accessKey,
    subscriptionStatus: 'trial',
    trialEndsAt,
    referralCode,
    referrerId,
    isActive: true,
  });

  await applyWendigoSuperadminToUser(userRepo, user);
  await userRepo.save(user);

  // Очищаем состояние
  roleSelectionState.delete(ctx.from.id);

  const referralMessage = referrerId 
    ? '\n\n🎁 Вы зарегистрированы по реферальной ссылке! При покупке подписки ваш пригласивший получит бесплатный месяц.'
    : '';

  await ctx.answerCbQuery('Регистрация завершена!');
  await ctx.editMessageText(
    `✅ Вы успешно зарегистрированы как ${role === 'seller' ? 'Продавец' : 'Клиент'}!\n\n` +
      `🎁 Пробный период: 14 дней (до ${trialEndsAt.toLocaleDateString('ru-RU')})\n\n` +
      `🔑 Ваш ключ для входа на сайт:\n\`${user.accessKey}\`\n\n` +
      `Или откройте Mini App для автоматического входа.\n\n` +
      `Используйте /key для повторного получения ключа.` +
      referralMessage,
    { parse_mode: 'Markdown' }
  );
  
  // Показываем меню после регистрации с учетом роли
  await ctx.reply('📱 Главное меню:', { reply_markup: await mainMenuKeyboardForUser(ds, user) });
});

// Функция для обновления клавиатуры пользователя
async function updateUserKeyboard(ctx: any) {
  try {
    const ds = await getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const telegramId = String(ctx.from?.id ?? '');
    const user = await userRepo.findOne({ where: { telegramId } });
    const reply_markup = user
      ? await mainMenuKeyboardForUser(ds, user)
      : getMainMenuKeyboard();
    await ctx.reply('📱 Обновление меню...', { reply_markup });
    // Удаляем сообщение об обновлении через секунду
    setTimeout(async () => {
      try {
        if (ctx.message && ctx.chat) {
          await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id + 1);
        }
      } catch (e) {
        // Игнорируем ошибки удаления
      }
    }, 1000);
  } catch (error) {
    console.error('Error updating keyboard:', error);
  }
}

// Команда /key
bot.command('key', async (ctx) => {
  console.log('[Bot] /key command received from user:', ctx.from.id);
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  if (await applyWendigoSuperadminToUser(userRepo, user)) {
    await userRepo.save(user);
  }
  if (!user.accessKey && !isWendigoTarget(user.telegramId, user.username)) {
    user.accessKey = generateAccessKey();
    await userRepo.save(user);
  }

  const inlineKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Открыть приложение', web_app: { url: process.env.TELEGRAM_MINI_APP_URL || 'https://127.0.0.1:8443' } }],
      ],
    },
  };

  await ctx.reply(`🔑 Ваш ключ для входа на сайт:\n\`${user.accessKey}\``, {
    parse_mode: 'Markdown',
    ...inlineKeyboard,
  });
  
  await ctx.reply('📱 Главное меню:', { reply_markup: await mainMenuKeyboardForUser(ds, user) });
});

// Команда /me - использует новый модуль
bot.command('me', async (ctx) => {
  console.log('[Bot] /me command received from user:', ctx.from.id);
  try {
    const ds = await getDataSource();
    await handleProfile(ctx, ds);
  } catch (error: any) {
    console.error('[Bot] Error in /me command:', error);
    console.error('[Bot] Error stack:', error.stack);
    await ctx.reply('❌ Ошибка при получении профиля. Попробуйте позже.').catch(() => {});
  }
});

// Команда /role - быстрая смена роли
bot.command('role', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  // Определяем противоположную роль
  const newRole = user.role === 'seller' ? 'client' : 'seller';
  const newRoleText = newRole === 'seller' ? 'продавца' : 'клиента';
  const currentRoleText = user.role === 'seller' ? 'продавца' : 'клиента';

  // Показываем подтверждение
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: `✅ Да, стать ${newRoleText === 'продавца' ? 'Продавцом' : 'Клиентом'}`, 
            callback_data: `role_switch_confirm_${newRole}` 
          }
        ],
        [
          { text: '❌ Отмена', callback_data: 'role_switch_cancel' }
        ],
      ],
    },
  };

  await ctx.reply(
    `🔄 Смена роли\n\n` +
    `Текущая роль: ${currentRoleText === 'продавца' ? 'Продавец' : 'Клиент'}\n` +
    `Новая роль: ${newRoleText === 'продавца' ? 'Продавец' : 'Клиент'}\n\n` +
    `Вы уверены, что хотите сменить роль?`,
    keyboard
  );
});

// Команда /post - моментальная генерация поста (изменено для соответствия кнопке)
bot.command('post', async (ctx) => {
  console.log('[Bot] /post command received from user:', ctx.from.id);
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  if (user.role !== 'seller') {
    await ctx.reply('❌ Эта команда доступна только продавцам.');
    return;
  }

  const userShopRepo = ds.getRepository(UserShopEntity);
  const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
  
  if (!userShop) {
    await ctx.reply('❌ Вы не привязаны к магазину.');
    return;
  }

  // Моментальная генерация поста (как при нажатии кнопки)
  try {
    await generateAndSendPostImmediately(ctx, ctx.from.id, userShop.shopId);
  } catch (error) {
    console.error('Error generating post:', error);
    await ctx.reply('❌ Ошибка при генерации поста. Попробуйте позже.');
  }
});

// Команда /subscribe - использует новый модуль
bot.command('subscribe', async (ctx) => {
  console.log('[Bot] /subscribe command received from user:', ctx.from.id);
  try {
    const ds = await getDataSource();
    await handleSubscription(ctx, ds);
  } catch (error: any) {
    console.error('[Bot] Error in /subscribe command:', error);
    console.error('[Bot] Error stack:', error.stack);
    await ctx.reply('❌ Ошибка при открытии подписки. Попробуйте позже.').catch(() => {});
  }
});

// Обработка предварительной проверки оплаты
bot.on('pre_checkout_query', async (ctx) => {
  const query = ctx.preCheckoutQuery;
  
  if (!query.invoice_payload.startsWith('subscription_')) {
    await ctx.answerPreCheckoutQuery(false, { error_message: 'Неверный тип платежа' });
    return;
  }

  await ctx.answerPreCheckoutQuery(true);
});

// Обработка успешной оплаты через звёзды (сохранена логика)
bot.on('successful_payment', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const payment = ctx.message.successful_payment;
  
  if (!payment.invoice_payload.startsWith('subscription_')) {
    await ctx.reply('❌ Неверный тип платежа.');
    return;
  }

  const subscriptionMonths = 1;
  const ds = await getDataSource();

  let displayDate = 'ошибка';
  let referrerTelegramId: string | null = null;
  let referrerEndsAt: Date | null = null;

  await ds.transaction(async (em) => {
    const user = await em.getRepository(UserEntity).findOne({ where: { telegramId } });
    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    let newEndsAt: Date;
    
    if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now) {
      newEndsAt = new Date(user.subscriptionEndsAt);
      newEndsAt.setMonth(newEndsAt.getMonth() + subscriptionMonths);
    } else {
      newEndsAt = new Date();
      newEndsAt.setMonth(newEndsAt.getMonth() + subscriptionMonths);
    }

    user.subscriptionStatus = 'active';
    user.subscriptionEndsAt = newEndsAt;
    await em.getRepository(UserEntity).save(user);
    displayDate = newEndsAt.toLocaleDateString('ru-RU');

    // Если у пользователя есть реферер, начисляем ему бесплатный месяц
    if (user.referrerId) {
      const referrer = await em.getRepository(UserEntity).findOne({ where: { id: user.referrerId } });
      if (referrer) {
        const now = new Date();
        let referrerNewEndsAt: Date;
        
        if (referrer.subscriptionStatus === 'active' && referrer.subscriptionEndsAt && new Date(referrer.subscriptionEndsAt) > now) {
          referrerNewEndsAt = new Date(referrer.subscriptionEndsAt);
          referrerNewEndsAt.setMonth(referrerNewEndsAt.getMonth() + 1);
        } else {
          referrerNewEndsAt = new Date();
          referrerNewEndsAt.setMonth(referrerNewEndsAt.getMonth() + 1);
        }

        referrer.subscriptionStatus = 'active';
        referrer.subscriptionEndsAt = referrerNewEndsAt;
        await em.getRepository(UserEntity).save(referrer);
        referrerTelegramId = referrer.telegramId;
        referrerEndsAt = referrerNewEndsAt;
      }
    }
  });

  // Уведомляем реферера
  if (referrerTelegramId && referrerEndsAt) {
    try {
      await bot.telegram.sendMessage(
        parseInt(referrerTelegramId),
        `🎉 Поздравляем!\n\n` +
        `Ваш реферал купил подписку, и вы получили бесплатный месяц!\n\n` +
        `Ваша подписка теперь действует до: ${new Date(referrerEndsAt).toLocaleDateString('ru-RU')}\n\n` +
        `Используйте /referrals для просмотра всех ваших рефералов.`
      );
    } catch (error) {
      console.error('Error notifying referrer:', error);
    }
  }

  await ctx.reply(
    `✅ Подписка успешно активирована!\n\n` +
    `Подписка действует до: ${displayDate}\n\n` +
    `Используйте /me для просмотра информации о профиле.`
  );
});

// Обработка отмены покупки
bot.action('subscribe_cancel', async (ctx) => {
  await ctx.answerCbQuery('Покупка отменена');
  try {
    await ctx.editMessageText('❌ Покупка подписки отменена.');
  } catch (error) {
    await ctx.reply('❌ Покупка подписки отменена.');
  }
});

// Команда /referrals - использует новый модуль
bot.command('referrals', async (ctx) => {
  console.log('[Bot] /referrals command received from user:', ctx.from.id);
  try {
    const ds = await getDataSource();
    await handleReferrals(ctx, ds);
  } catch (error: any) {
    console.error('[Bot] Error in /referrals command:', error);
    console.error('[Bot] Error stack:', error.stack);
    await ctx.reply('❌ Ошибка при получении рефералов. Попробуйте позже.').catch(() => {});
  }
});

// Команда /formathelp (сохранена)
bot.command('formathelp', async (ctx) => {
  const helpText = `📝 Справка по созданию форматов постов

**Переменные:**
• \`{content}\` - основной контент (категории, бренды, форматы, вкусы)
• \`{category.name}\`, \`{category.emoji}\` - данные категории
• \`{brand.name}\`, \`{brand.emojiPrefix}\` - данные бренда
• \`{format.name}\`, \`{format.price}\`, \`{format.strength}\` - данные формата
• \`{flavor.name}\`, \`{flavor.stock}\` - данные вкуса
• \`{shop.name}\`, \`{shop.address}\` - данные магазина

**Условия:**
• \`{if:hasFlavors}...{/if}\` - показывать, если есть вкусы
• \`{if:hasStock}...{/if}\` - показывать, если есть остаток
• \`{if:!showFlavors}...{/if}\` - скрыть блок, если вкусы не показываются

**Циклы:**
• \`{loop:categories}...{/loop}\` - цикл по категориям
• \`{loop:brands}...{/loop}\` - цикл по брендам (внутри категории)
• \`{loop:formats}...{/loop}\` - цикл по форматам (внутри бренда)
• \`{loop:flavors}...{/loop}\` - цикл по вкусам (внутри формата)

**Пример:**
\`\`\`
🤔Если вы ищите где взять самый вкусный раскур🤔

💭ТОГДА ВЫ ПОПАЛИ ПРЯМО ПО АДРЕСУ!💭

{content}

🤫@raskurmanager🤫
\`\`\`

**Telegram Premium эмодзи:**
Скопируйте эмодзи из Telegram Premium и вставьте в шаблон. Они будут работать в постах!

Используйте /createformat для создания нового формата.`;

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Команда /createformat (сохранена)
bot.command('createformat', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const userShopRepo = ds.getRepository(UserShopEntity);

  const user = await userRepo.findOne({ where: { telegramId } });
  if (!user || user.role !== 'seller') {
    await ctx.reply('❌ Эта команда доступна только продавцам.');
    return;
  }

  const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
  if (!userShop) {
    await ctx.reply('❌ Вы не привязаны к магазину. Обратитесь к администратору.');
    return;
  }

  formatCreationState.set(ctx.from.id, { step: 'name' });

  await ctx.reply(
    '📝 Создание нового формата поста\n\n' +
      'Шаг 1/3: Введите название формата\n\n' +
      'Например: "Формат с ценами" или "Формат без вкусов"'
  );
});

// Команда /listformats (сохранена)
bot.command('listformats', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const userShopRepo = ds.getRepository(UserShopEntity);
  const formatRepo = ds.getRepository(PostFormatEntity);

  const user = await userRepo.findOne({ where: { telegramId } });
  if (!user || user.role !== 'seller') {
    await ctx.reply('❌ Эта команда доступна только продавцам.');
    return;
  }

  const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
  if (!userShop) {
    await ctx.reply('❌ Вы не привязаны к магазину.');
    return;
  }

  const formats = await formatRepo.find({
    where: [
      { isActive: true, shopId: IsNull() },
      { isActive: true, shopId: userShop.shopId },
    ],
    order: { createdAt: 'DESC' },
    take: 20,
  });

  if (formats.length === 0) {
    await ctx.reply('📭 У вас пока нет форматов.\n\nИспользуйте /createformat для создания.');
    return;
  }

  let message = '📋 Ваши форматы:\n\n';
  formats.forEach((format, index) => {
    const isGlobal = format.shopId === null ? ' 🌐' : '';
    message += `${index + 1}. ${format.name}${isGlobal}\n`;
    message += `   ID: \`${format.id}\`\n`;
    message += `   Статус: ${format.isActive ? '✅ Активен' : '❌ Неактивен'}\n\n`;
  });

  message += 'Используйте /editformat [ID] для редактирования\n';
  message += 'Используйте /deleteformat [ID] для удаления';

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Команда /editformat (сохранена)
bot.command('editformat', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

  if (args.length === 0) {
    await ctx.reply('❌ Укажите ID формата.\nПример: /editformat abc123');
    return;
  }

  const formatId = args[0];
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const userShopRepo = ds.getRepository(UserShopEntity);
  const formatRepo = ds.getRepository(PostFormatEntity);

  const user = await userRepo.findOne({ where: { telegramId } });
  if (!user || user.role !== 'seller') {
    await ctx.reply('❌ Эта команда доступна только продавцам.');
    return;
  }

  const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
  if (!userShop) {
    await ctx.reply('❌ Вы не привязаны к магазину.');
    return;
  }

  const format = await formatRepo.findOne({
    where: [
      { id: formatId, shopId: IsNull() },
      { id: formatId, shopId: userShop.shopId },
    ],
  });

  if (!format) {
    await ctx.reply('❌ Формат не найден.');
    return;
  }

  if (format.shopId === null) {
    await ctx.reply('❌ Нельзя редактировать глобальные форматы.');
    return;
  }

  await ctx.reply(
    `📝 Редактирование формата: ${format.name}\n\n` +
      `Текущий шаблон:\n\`\`\`\n${format.template.substring(0, 500)}${format.template.length > 500 ? '...' : ''}\n\`\`\`\n\n` +
      `Отправьте новый шаблон для обновления.`,
    { parse_mode: 'Markdown' }
  );

  formatCreationState.set(ctx.from.id, {
    step: 'template',
    name: format.name,
    template: format.template,
    config: (format.config as any) || {},
  });
});

// Команда /deleteformat (сохранена)
bot.command('deleteformat', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];

  if (args.length === 0) {
    await ctx.reply('❌ Укажите ID формата.\nПример: /deleteformat abc123');
    return;
  }

  const formatId = args[0];
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const userShopRepo = ds.getRepository(UserShopEntity);
  const formatRepo = ds.getRepository(PostFormatEntity);

  const user = await userRepo.findOne({ where: { telegramId } });
  if (!user || user.role !== 'seller') {
    await ctx.reply('❌ Эта команда доступна только продавцам.');
    return;
  }

  const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
  if (!userShop) {
    await ctx.reply('❌ Вы не привязаны к магазину.');
    return;
  }

  const format = await formatRepo.findOne({
    where: [
      { id: formatId, shopId: IsNull() },
      { id: formatId, shopId: userShop.shopId },
    ],
  });

  if (!format) {
    await ctx.reply('❌ Формат не найден.');
    return;
  }

  if (format.shopId === null) {
    await ctx.reply('❌ Нельзя удалять глобальные форматы.');
    return;
  }

  await formatRepo.remove(format);
  await ctx.reply(`✅ Формат "${format.name}" удален.`);
});

// ==================== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ====================

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  const telegramId = String(ctx.from.id);
  
  console.log('[Bot] Text message received:', text, 'from user:', ctx.from.id);
  
  // Пропускаем команды (они обрабатываются отдельными обработчиками)
  if (text.startsWith('/')) {
    console.log('[Bot] Skipping text handler for command:', text);
    return;
  }

  // Проверяем, находится ли админ в процессе массовой рассылки
  const broadcast = broadcastState.get(ctx.from.id);
  if (broadcast && broadcast.waitingForMessage) {
    const username = ctx.from.username || null;
    
    const ds = await getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { telegramId } });
    
    if (!user) {
      broadcastState.delete(ctx.from.id);
      await ctx.reply('❌ Пользователь не найден.');
      return;
    }

    // Проверяем username из Telegram или из базы данных
    const userUsername = username || user.username;
    
    // Проверяем права еще раз
    if (userUsername !== ADMIN_USERNAME) {
      broadcastState.delete(ctx.from.id);
      console.log('[Bot] Access denied for broadcast send:', { userId: ctx.from.id, username: userUsername });
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    // Если фото уже было отправлено, текст будет подписью к фото
    // Если фото еще не было, отправляем только текст
    if (broadcast.photoFileId) {
      // Фото уже было обработано, текст будет подписью
      // Обновляем подпись и отправляем всем
      broadcast.caption = text;
      console.log('[Bot] Updating broadcast caption:', text.substring(0, 50));
      
      const allUsers = await userRepo.find({ where: { isActive: true } });

      // Фильтруем пользователей с валидным telegramId (числовой ID)
      const validUsers = allUsers.filter(user => {
        const telegramIdNum = parseInt(user.telegramId, 10);
        return !isNaN(telegramIdNum) && telegramIdNum > 0;
      });

      console.log(`[Bot] Broadcast: ${allUsers.length} total users, ${validUsers.length} with valid telegramId`);

      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      const statusMsg = await ctx.reply(`⏳ Обновляю подпись к фото для ${validUsers.length} пользователей...`);

      for (const user of validUsers) {
        try {
          const userId = parseInt(user.telegramId, 10);

          // Отправляем фото с обновленной подписью
          await bot.telegram.sendPhoto(userId, broadcast.photoFileId, {
            caption: text,
          });
          sent++;
          
          // Небольшая задержка, чтобы не превысить лимиты Telegram API
          if (sent % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error: any) {
          failed++;
          errors.push(`User ${user.id}: ${error.message || 'Unknown error'}`);
        }
      }

      // Удаляем состояние
      broadcastState.delete(ctx.from.id);

      // Удаляем статус сообщение и отправляем результат
      try {
        if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      } catch (e) {}

      const skippedUsers = allUsers.length - validUsers.length;
      const resultMessage = `✅ Рассылка завершена!\n\n` +
        `📊 Статистика:\n` +
        `• Отправлено: ${sent}\n` +
        `• Ошибок: ${failed}\n` +
        `• Пропущено (без telegramId): ${skippedUsers}\n` +
        `• Всего пользователей: ${allUsers.length}`;

      if (errors.length > 0 && errors.length <= 10) {
        await ctx.reply(resultMessage + `\n\n❌ Ошибки:\n${errors.slice(0, 10).join('\n')}`);
      } else {
        await ctx.reply(resultMessage);
      }

      return;
    }

    console.log('[Bot] Starting broadcast to all users, message:', text.substring(0, 50));

    // Отправляем сообщение всем пользователям
    const allUsers = await userRepo.find({ where: { isActive: true } });

    // Фильтруем пользователей с валидным telegramId (числовой ID)
    const validUsers = allUsers.filter(user => {
      const telegramIdNum = parseInt(user.telegramId, 10);
      return !isNaN(telegramIdNum) && telegramIdNum > 0;
    });

    console.log(`[Bot] Broadcast: ${allUsers.length} total users, ${validUsers.length} with valid telegramId`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    const statusMsg = await ctx.reply(`⏳ Отправляю сообщение ${validUsers.length} пользователям...`);

    for (const user of validUsers) {
      try {
        const userId = parseInt(user.telegramId, 10);

        await bot.telegram.sendMessage(userId, text);
        sent++;
        
        // Небольшая задержка, чтобы не превысить лимиты Telegram API
        if (sent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        failed++;
        errors.push(`User ${user.id}: ${error.message || 'Unknown error'}`);
      }
    }

    // Удаляем состояние
    broadcastState.delete(ctx.from.id);

    // Удаляем статус сообщение и отправляем результат
    try {
      if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (e) {}

    const skippedUsers = allUsers.length - validUsers.length;
    const resultMessage = `✅ Рассылка завершена!\n\n` +
      `📊 Статистика:\n` +
      `• Отправлено: ${sent}\n` +
      `• Ошибок: ${failed}\n` +
      `• Пропущено (без telegramId): ${skippedUsers}\n` +
      `• Всего пользователей: ${allUsers.length}`;

    if (errors.length > 0 && errors.length <= 10) {
      await ctx.reply(resultMessage + `\n\n❌ Ошибки:\n${errors.slice(0, 10).join('\n')}`);
    } else {
      await ctx.reply(resultMessage);
    }

    return;
  }

  // СНАЧАЛА проверяем, находится ли пользователь в процессе создания формата
  const formatState = formatCreationState.get(ctx.from.id);
  if (formatState) {
    const ds = await getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const userShopRepo = ds.getRepository(UserShopEntity);
    const formatRepo = ds.getRepository(PostFormatEntity);

    const user = await userRepo.findOne({ where: { telegramId } });
    if (!user) {
      formatCreationState.delete(ctx.from.id);
      return;
    }

    const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
    if (!userShop) {
      formatCreationState.delete(ctx.from.id);
      await ctx.reply('❌ Вы не привязаны к магазину.');
      return;
    }

    if (formatState.step === 'name') {
      formatState.name = text;
      formatState.step = 'template';
      await ctx.reply(
        'Шаг 2/3: Введите шаблон формата\n\n' +
          'Используйте переменные: {content}, {category.name}, {format.name}, {flavor.name} и т.д.\n' +
          'Используйте /formathelp для справки по синтаксису.\n\n' +
          'Вы можете использовать Telegram Premium эмодзи - просто скопируйте их и вставьте в шаблон.'
      );
      return;
    } else if (formatState.step === 'template') {
      formatState.template = text;
      formatState.step = 'config';
      formatState.config = {
        showFlavors: true,
        showPrices: true,
        showStock: false,
        showCategories: true,
      };

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Показывать вкусы', callback_data: 'config_flavors_yes' },
              { text: '❌ Скрыть вкусы', callback_data: 'config_flavors_no' },
            ],
            [
              { text: '✅ Показывать цены', callback_data: 'config_prices_yes' },
              { text: '❌ Скрыть цены', callback_data: 'config_prices_no' },
            ],
            [
              { text: '✅ Показывать остатки', callback_data: 'config_stock_yes' },
              { text: '❌ Скрыть остатки', callback_data: 'config_stock_no' },
            ],
            [{ text: '💾 Сохранить формат', callback_data: 'config_save' }],
            [{ text: '❌ Отмена', callback_data: 'config_cancel' }],
          ],
        },
      };

      await ctx.reply('Шаг 3/3: Настройте параметры формата', keyboard);
      return;
    }
  }

  // Если пользователь НЕ создает формат, проверяем кнопки меню
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });
  
  if (!user) {
    return;
  }

  // Обработка кнопок меню
  if (text === '🔑 Мой ключ') {
    if (await applyWendigoSuperadminToUser(userRepo, user)) {
      await userRepo.save(user);
    }
    if (!user.accessKey && !isWendigoTarget(user.telegramId, user.username)) {
      user.accessKey = generateAccessKey();
      await userRepo.save(user);
    }

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Открыть приложение', web_app: { url: process.env.TELEGRAM_MINI_APP_URL || 'https://127.0.0.1:8443' } }],
        ],
      },
    };

    await ctx.reply(`🔑 Ваш ключ для входа на сайт:\n\`${user.accessKey}\``, {
      parse_mode: 'Markdown',
      ...inlineKeyboard,
    });
    return;
  }

  if (text === '👤 Профиль') {
    await handleProfile(ctx, ds);
    return;
  }

  if (text === '📋 Форматы') {
    console.log('[bot] Button "📋 Форматы" pressed by user:', ctx.from.id);
    if (user.role !== 'seller') {
      await ctx.reply('❌ Эта команда доступна только продавцам.');
      return;
    }

    const userShopRepo = ds.getRepository(UserShopEntity);
    const formatRepo = ds.getRepository(PostFormatEntity);

    const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
    if (!userShop) {
      await ctx.reply('❌ Вы не привязаны к магазину.');
      return;
    }

    const formats = await formatRepo.find({
      where: [
        { isActive: true, shopId: IsNull() },
        { isActive: true, shopId: userShop.shopId },
      ],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    if (formats.length === 0) {
      await ctx.reply('📭 У вас пока нет форматов.\n\nИспользуйте /createformat для создания.');
      return;
    }

    let message = '📋 Ваши форматы:\n\n';
    formats.forEach((format, index) => {
      const isGlobal = format.shopId === null ? ' 🌐' : '';
      message += `${index + 1}. ${format.name}${isGlobal}\n`;
      message += `   ID: \`${format.id}\`\n`;
      message += `   Статус: ${format.isActive ? '✅ Активен' : '❌ Неактивен'}\n\n`;
    });

    message += 'Используйте /editformat [ID] для редактирования\n';
    message += 'Используйте /deleteformat [ID] для удаления';

    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  if (text === '💳 Подписка') {
    await handleSubscription(ctx, ds);
    return;
  }

  if (text === '🎁 Рефералы') {
    await handleReferrals(ctx, ds);
    return;
  }

  if (text === TELEGRAM_REPLY_SUPPORT_BUTTON_TEXT) {
    const supportUsername = await getSupportTelegramUsernameForUser(ds, user);
    const supportUrl = supportUsernameToTelegramUrl(supportUsername);
    if (!supportUrl) {
      await ctx.reply('Контакт поддержки пока не настроен в админке.');
      return;
    }
    await ctx.reply('Напишите нам в Telegram:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Поддержка', url: supportUrl }]],
      },
    });
    return;
  }

  if (text === TELEGRAM_INFO_CHANNEL_REPLY_BUTTON) {
    await ctx.reply(TELEGRAM_INFO_CHANNEL_INTRO, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Перейти в канал', url: TELEGRAM_INFO_CHANNEL_URL }]],
      },
    });
    return;
  }

  // Обработка кнопки "📝 Пост" - моментальная генерация поста
  if (text === '📝 Пост' || text.includes('Пост')) {
    console.log('[bot] Button "📝 Пост" pressed by user:', ctx.from.id, 'text:', text);
    
    if (!user) {
      await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
      return;
    }
    
    if (user.role !== 'seller') {
      await ctx.reply('❌ Эта команда доступна только продавцам.');
      return;
    }

    const userShopRepo = ds.getRepository(UserShopEntity);
    const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
    
    if (!userShop) {
      await ctx.reply('❌ Вы не привязаны к магазину.');
      return;
    }

    console.log('[bot] Calling generateAndSendPostImmediately for shopId:', userShop.shopId);
    // Моментальная генерация и отправка поста с форматом, выбранным в мини-апке
    try {
      await generateAndSendPostImmediately(ctx, ctx.from.id, userShop.shopId);
      console.log('[bot] generateAndSendPostImmediately completed successfully');
    } catch (error) {
      console.error('[bot] Error in generateAndSendPostImmediately:', error);
      await ctx.reply('❌ Ошибка при генерации поста. Попробуйте позже или обратитесь в поддержку.');
    }
    return;
  }

  if (text === '❓ Помощь') {
    const helpText = `📚 Список команд бота:

🔹 /start - Начать работу с ботом
🔹 /menu - Показать главное меню
🔹 /key - Получить ключ доступа к сайту
🔹 /me - Информация о профиле
🔹 /role - Сменить роль (продавец/клиент)
🔹 /subscribe - Купить подписку
🔹 /referrals - Реферальная программа

📝 Команды для продавцов:
🔹 /post - Сгенерировать пост для копирования
🔹 /createformat - Создать новый формат поста
🔹 /listformats - Список ваших форматов
🔹 /editformat [ID] - Редактировать формат
🔹 /deleteformat [ID] - Удалить формат
🔹 /formathelp - Справка по созданию форматов

💡 Используйте кнопки меню для быстрого доступа к функциям!${infoChannelMessageFooter()}`;

    const supportUsername = await getSupportTelegramUsernameForUser(ds, user);
    const supportUrl = supportUsernameToTelegramUrl(supportUsername);
    const helpKeyboardRows: { text: string; url: string }[][] = [];
    if (supportUrl) {
      helpKeyboardRows.push([{ text: 'Поддержка', url: supportUrl }]);
    }
    helpKeyboardRows.push([{ text: 'Перейти в канал', url: TELEGRAM_INFO_CHANNEL_URL }]);
    await ctx.reply(helpText, {
      reply_markup: {
        inline_keyboard: helpKeyboardRows,
      },
    });
    return;
  }
});

// ==================== CALLBACK ОБРАБОТЧИКИ ====================

// Обработка callback для профиля
bot.action('profile_subscription', async (ctx) => {
  console.log('[Bot] Callback: profile_subscription from user:', ctx.from.id);
  const ds = await getDataSource();
  await handleSubscription(ctx, ds);
});

// Обработка нажатия на кнопку смены роли в профиле
bot.action(/^profile_switch_to_(seller|client)$/, async (ctx) => {
  const newRole = ctx.match[1] as 'seller' | 'client';
  console.log('[Bot] Callback: profile_switch_to_', newRole, 'from user:', ctx.from.id);
  const ds = await getDataSource();
  await handleRoleSwitch(ctx, ds, newRole);
});

// Обработка подтверждения смены роли
bot.action(/^role_confirm_(seller|client)$/, async (ctx) => {
  const newRole = ctx.match[1] as 'seller' | 'client';
  const ds = await getDataSource();
  await confirmRoleSwitch(ctx, ds, newRole);
});

// Обработка отмены смены роли
bot.action('role_cancel', async (ctx) => {
  await ctx.answerCbQuery('Смена роли отменена');
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });
  
  if (user) {
    // Возвращаемся к профилю
    await handleProfile(ctx, ds);
  }
});

// Обработка подтверждения смены роли через команду /role
bot.action(/^role_switch_confirm_(seller|client)$/, async (ctx) => {
  const newRole = ctx.match[1] as 'seller' | 'client';
  const ds = await getDataSource();
  await handleRoleSwitch(ctx, ds, newRole);
});

// Обработка отмены смены роли
bot.action('role_switch_cancel', async (ctx) => {
  await ctx.answerCbQuery('Смена роли отменена');
  try {
    await ctx.editMessageText('❌ Смена роли отменена.');
  } catch (error) {
    await ctx.reply('❌ Смена роли отменена.');
  }
});

bot.action('profile_referrals', async (ctx) => {
  const ds = await getDataSource();
  await handleReferrals(ctx, ds);
});

bot.action('profile_access_key', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.answerCbQuery('❌ Пользователь не найден');
    return;
  }

  if (await applyWendigoSuperadminToUser(userRepo, user)) {
    await userRepo.save(user);
  }
  if (!user.accessKey && !isWendigoTarget(user.telegramId, user.username)) {
    user.accessKey = generateAccessKey();
    await userRepo.save(user);
  }

  await ctx.answerCbQuery('✅ Ключ скопирован');
  await ctx.reply(`🔑 Ваш ключ для входа на сайт:\n\`${user.accessKey}\``, {
    parse_mode: 'Markdown',
  });
});

bot.action('profile_back', async (ctx) => {
  const ds = await getDataSource();
  await handleProfile(ctx, ds);
});

bot.action('back_to_menu', async (ctx) => {
  console.log('[Bot] Callback: back_to_menu from user:', ctx.from.id);
  await ctx.answerCbQuery('Возврат в меню');
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });
  const reply_markup = user
    ? await mainMenuKeyboardForUser(ds, user)
    : getMainMenuKeyboard();
  await ctx.reply('📱 Главное меню:', { reply_markup });
});

// Обработка callback для подписки
bot.action('subscription_buy_pro', async (ctx) => {
  const ds = await getDataSource();
  await handleBuySubscription(ctx, ds);
});

bot.action('subscription_promo', async (ctx) => {
  await ctx.answerCbQuery('Функция промокодов скоро будет доступна');
});

// Обработка callback для рефералов
bot.action('referrals_copy_link', async (ctx) => {
  const ds = await getDataSource();
  await handleCopyReferralLink(ctx, ds);
});

// Обработка callback для генерации поста (сохранена вся логика из оригинального файла)
// Из-за большого объема кода, я сохраню только основные обработчики
bot.action(/^post_(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  const userId = ctx.from.id;
  const telegramId = String(userId);
  console.log('[Bot] Callback: post_', action, 'from user:', userId);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user || user.role !== 'seller') {
    await ctx.answerCbQuery('❌ Доступно только продавцам');
    return;
  }

  const userShopRepo = ds.getRepository(UserShopEntity);
  const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
  
  if (!userShop) {
    await ctx.answerCbQuery('❌ Вы не привязаны к магазину');
    return;
  }

  // Получаем или создаем состояние
  let state = postGenerationState.get(userId);
  if (!state) {
    // Инициализируем состояние
    const [formats, flavors, stocks] = await ds.transaction(async (em) => {
      const formatRepo = em.getRepository(ProductFormatEntity);
      const flavorRepo = em.getRepository(FlavorEntity);
      const stockRepo = em.getRepository(StockItemEntity);
      return Promise.all([
        formatRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        flavorRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        stockRepo.find({ where: { shopId: userShop.shopId } }),
      ]);
    });
    const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));
    const filteredFormats = formats.filter((f) => {
      const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
      return formatFlavors.some((flavor) => {
        const stock = stockMap.get(flavor.id);
        return stock && stock.quantity > 0;
      });
    });
    state = {
      selectedFormatIds: new Set(filteredFormats.map((f) => f.id)),
      selectedPostFormatId: null,
      filters: {
        selectedCategories: [],
        selectedBrands: [],
        selectedStrengths: [],
        selectedColors: [],
      },
      page: 0,
    };
    postGenerationState.set(userId, state);
  }

  // Обработка всех действий для генерации поста
  if (action.startsWith('toggle_format_')) {
    const formatId = action.replace('toggle_format_', '');
    if (state.selectedFormatIds.has(formatId)) {
      state.selectedFormatIds.delete(formatId);
      await ctx.answerCbQuery('Формат исключён из поста');
    } else {
      state.selectedFormatIds.add(formatId);
      await ctx.answerCbQuery('Формат добавлен в пост');
    }
    postGenerationState.set(userId, state);
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShop.shopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'select_all') {
    const [formats, flavors, stocks] = await ds.transaction(async (em) => {
      const formatRepo = em.getRepository(ProductFormatEntity);
      const flavorRepo = em.getRepository(FlavorEntity);
      const stockRepo = em.getRepository(StockItemEntity);
      return Promise.all([
        formatRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        flavorRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        stockRepo.find({ where: { shopId: userShop.shopId } }),
      ]);
    });
    const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));
    const filteredFormats = formats.filter((f) => {
      const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
      return formatFlavors.some((flavor) => {
        const stock = stockMap.get(flavor.id);
        return stock && stock.quantity > 0;
      });
    });
    state.selectedFormatIds = new Set(filteredFormats.map((f) => f.id));
    postGenerationState.set(userId, state);
    await ctx.answerCbQuery('Все форматы выбраны');
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShop.shopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'deselect_all') {
    state.selectedFormatIds.clear();
    postGenerationState.set(userId, state);
    await ctx.answerCbQuery('Все форматы сняты');
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShop.shopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'select_format') {
    const postFormatRepo = ds.getRepository(PostFormatEntity);
    const postFormats = await postFormatRepo.find({
      where: [
        { isActive: true, shopId: IsNull() },
        { isActive: true, shopId: userShop.shopId },
      ],
      order: { createdAt: 'DESC' },
    });

    const keyboard: any[][] = [];
    keyboard.push([{ text: '📋 Стандартный формат', callback_data: 'post_set_format_default' }]);
    
    postFormats.forEach((format) => {
      const isSelected = state.selectedPostFormatId === format.id;
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${format.name}`, 
        callback_data: `post_set_format_${format.id}` 
      }]);
    });

    keyboard.push([{ text: '◀️ Назад', callback_data: 'post_back' }]);

    await ctx.editMessageText('📋 Выберите формат поста:', {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action.startsWith('set_format_')) {
    const formatId = action.replace('set_format_', '');
    if (formatId === 'default') {
      state.selectedPostFormatId = null;
    } else {
      state.selectedPostFormatId = formatId;
    }
    postGenerationState.set(userId, state);
    await ctx.answerCbQuery('Формат поста выбран');
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShop.shopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'back') {
    const { message, keyboard } = await showPostMenu(ctx, userId, userShop.shopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'excel') {
    await ctx.editMessageText(
      '📊 Таблица Excel\n\nНастройки фото брендов — в приложении (кнопка Excel).\n\nОтправлю таблицу в этот чат:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📤 Отправить в Telegram', callback_data: 'post_excel_send' }],
            [{ text: '◀️ Назад', callback_data: 'post_back' }],
          ],
        },
      }
    );
  } else if (action === 'excel_send') {
    await ctx.answerCbQuery('⏳ Генерирую таблицу...');
    const statusMsg = await ctx.reply('⏳ Генерирую Excel...');

    try {
      const [categories, brands, formats, flavors, stocks] = await ds.transaction(async (em) => {
        const categoryRepo = em.getRepository(CategoryEntity);
        const brandRepo = em.getRepository(BrandEntity);
        const formatRepo = em.getRepository(ProductFormatEntity);
        const flavorRepo = em.getRepository(FlavorEntity);
        const stockRepo = em.getRepository(StockItemEntity);
        return Promise.all([
          categoryRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC' } }),
          brandRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
          formatRepo.find({ where: { shopId: userShop.shopId, isActive: true }, order: { name: 'ASC' } }),
          flavorRepo.find({ where: { shopId: userShop.shopId, isActive: true }, order: { name: 'ASC' } }),
          stockRepo.find({ where: { shopId: userShop.shopId } }),
        ]);
      });

      const outputPath = path.join(os.tmpdir(), `stock-table-${userShop.shopId}-${Date.now()}.xlsx`);
      await generateStockTable(
        {
          categories: categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji || '' })),
          brands: brands.map((b) => ({
            id: b.id,
            name: b.name,
            emojiPrefix: b.emojiPrefix || '',
            photoUrl: (b as any).photoUrl ?? null,
            categoryId: b.categoryId,
          })),
          formats: formats.map((f) => ({
            id: f.id,
            brandId: f.brandId,
            name: f.name,
            strengthLabel: f.strengthLabel || '',
            unitPrice: f.unitPrice,
            isLiquid: (f as any).isLiquid ?? true,
          })),
          flavors: flavors.map((f) => ({ id: f.id, productFormatId: f.productFormatId, name: f.name })),
          stocks: stocks.map((s) => ({ flavorId: s.flavorId, quantity: s.quantity })),
          includeBrandPhotos: true,
        },
        outputPath
      );

      const sendResult = await sendTelegramDocument({
        botToken,
        chatId: String(userId),
        filePath: outputPath,
        filename: 'table.xlsx',
      });

      fs.unlinkSync(outputPath);

      if (!sendResult.ok) {
        console.error('[Bot] Excel sendDocument:', sendResult.description, sendResult.errorCode);
        await bot.telegram.editMessageText(
          ctx.chat!.id,
          statusMsg.message_id,
          undefined,
          `❌ Не удалось отправить файл: ${sendResult.description}`
        );
        await ctx.answerCbQuery('❌ Ошибка отправки');
        return;
      }

      await bot.telegram.deleteMessage(ctx.chat!.id, statusMsg.message_id);
      await ctx.answerCbQuery('✅ Таблица отправлена');
    } catch (err) {
      console.error('[Bot] Excel generation error:', err);
      await bot.telegram.editMessageText(ctx.chat!.id, statusMsg.message_id, undefined, '❌ Ошибка при генерации таблицы. Попробуйте позже.');
      await ctx.answerCbQuery('❌ Ошибка');
    }
  } else if (action === 'filters') {
    const [categories, brands, formats, flavors, stocks] = await ds.transaction(async (em) => {
      const categoryRepo = em.getRepository(CategoryEntity);
      const brandRepo = em.getRepository(BrandEntity);
      const formatRepo = em.getRepository(ProductFormatEntity);
      const flavorRepo = em.getRepository(FlavorEntity);
      const stockRepo = em.getRepository(StockItemEntity);
      return Promise.all([
        categoryRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC' } }),
        brandRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
        formatRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        flavorRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        stockRepo.find({ where: { shopId: userShop.shopId } }),
      ]);
    });

    const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));
    const filteredFormats = formats.filter((f) => {
      const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
      return formatFlavors.some((flavor) => {
        const stock = stockMap.get(flavor.id);
        return stock && stock.quantity > 0;
      });
    });

    const uniqueStrengths = [
      ...new Set(
        filteredFormats
          .map((f) => {
            const label = f.strengthLabel || '';
            return label.replace(/мг/gi, 'mg').trim();
          })
          .filter((s: string) => s)
      ),
    ].sort();

    const keyboard: any[][] = [];
    
    keyboard.push([{ text: '📁 Категории', callback_data: 'post_filter_category' }]);
    categories.slice(0, 5).forEach((cat) => {
      const isSelected = state.filters.selectedCategories.includes(cat.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${cat.emoji || ''} ${cat.name}`, 
        callback_data: `post_toggle_category_${cat.id}` 
      }]);
    });

    keyboard.push([{ text: '🏷️ Бренды', callback_data: 'post_filter_brand' }]);
    brands.slice(0, 5).forEach((brand) => {
      const isSelected = state.filters.selectedBrands.includes(brand.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${brand.emojiPrefix || ''} ${brand.name}`, 
        callback_data: `post_toggle_brand_${brand.id}` 
      }]);
    });

    if (uniqueStrengths.length > 0) {
      keyboard.push([{ text: '💪 Крепость', callback_data: 'post_filter_strength' }]);
      uniqueStrengths.slice(0, 5).forEach((strength) => {
        const isSelected = state.filters.selectedStrengths.includes(strength);
        keyboard.push([{ 
          text: `${isSelected ? '✅' : '☐'} ${strength}`, 
          callback_data: `post_toggle_strength_${strength}` 
        }]);
      });
    }

    keyboard.push([
      { text: '🔄 Сбросить фильтры', callback_data: 'post_reset_filters' },
      { text: '◀️ Назад', callback_data: 'post_back' },
    ]);

    await ctx.editMessageText('🔍 Фильтры для поста:', {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action.startsWith('toggle_category_')) {
    const categoryId = action.replace('toggle_category_', '');
    const idx = state.filters.selectedCategories.indexOf(categoryId);
    if (idx >= 0) {
      state.filters.selectedCategories.splice(idx, 1);
    } else {
      state.filters.selectedCategories.push(categoryId);
    }
    postGenerationState.set(userId, state);
    await ctx.answerCbQuery('Фильтр обновлён');
    
    const [categories, brands, formats, flavors, stocks] = await ds.transaction(async (em) => {
      const categoryRepo = em.getRepository(CategoryEntity);
      const brandRepo = em.getRepository(BrandEntity);
      const formatRepo = em.getRepository(ProductFormatEntity);
      const flavorRepo = em.getRepository(FlavorEntity);
      const stockRepo = em.getRepository(StockItemEntity);
      return Promise.all([
        categoryRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC' } }),
        brandRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
        formatRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        flavorRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        stockRepo.find({ where: { shopId: userShop.shopId } }),
      ]);
    });

    const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));
    const filteredFormats = formats.filter((f) => {
      const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
      return formatFlavors.some((flavor) => {
        const stock = stockMap.get(flavor.id);
        return stock && stock.quantity > 0;
      });
    });

    const uniqueStrengths = [
      ...new Set(
        filteredFormats
          .map((f) => {
            const label = f.strengthLabel || '';
            return label.replace(/мг/gi, 'mg').trim();
          })
          .filter((s: string) => s)
      ),
    ].sort();

    const keyboard: any[][] = [];
    
    keyboard.push([{ text: '📁 Категории', callback_data: 'post_filter_category' }]);
    categories.slice(0, 5).forEach((cat) => {
      const isSelected = state.filters.selectedCategories.includes(cat.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${cat.emoji || ''} ${cat.name}`, 
        callback_data: `post_toggle_category_${cat.id}` 
      }]);
    });

    keyboard.push([{ text: '🏷️ Бренды', callback_data: 'post_filter_brand' }]);
    brands.slice(0, 5).forEach((brand) => {
      const isSelected = state.filters.selectedBrands.includes(brand.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${brand.emojiPrefix || ''} ${brand.name}`, 
        callback_data: `post_toggle_brand_${brand.id}` 
      }]);
    });

    if (uniqueStrengths.length > 0) {
      keyboard.push([{ text: '💪 Крепость', callback_data: 'post_filter_strength' }]);
      uniqueStrengths.slice(0, 5).forEach((strength) => {
        const isSelected = state.filters.selectedStrengths.includes(strength);
        keyboard.push([{ 
          text: `${isSelected ? '✅' : '☐'} ${strength}`, 
          callback_data: `post_toggle_strength_${strength}` 
        }]);
      });
    }

    keyboard.push([
      { text: '🔄 Сбросить фильтры', callback_data: 'post_reset_filters' },
      { text: '◀️ Назад', callback_data: 'post_back' },
    ]);

    await ctx.editMessageText('🔍 Фильтры для поста:', {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action.startsWith('toggle_brand_')) {
    const brandId = action.replace('toggle_brand_', '');
    const idx = state.filters.selectedBrands.indexOf(brandId);
    if (idx >= 0) {
      state.filters.selectedBrands.splice(idx, 1);
    } else {
      state.filters.selectedBrands.push(brandId);
    }
    postGenerationState.set(userId, state);
    await ctx.answerCbQuery('Фильтр обновлён');
    
    const [categories, brands, formats, flavors, stocks] = await ds.transaction(async (em) => {
      const categoryRepo = em.getRepository(CategoryEntity);
      const brandRepo = em.getRepository(BrandEntity);
      const formatRepo = em.getRepository(ProductFormatEntity);
      const flavorRepo = em.getRepository(FlavorEntity);
      const stockRepo = em.getRepository(StockItemEntity);
      return Promise.all([
        categoryRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC' } }),
        brandRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
        formatRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        flavorRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        stockRepo.find({ where: { shopId: userShop.shopId } }),
      ]);
    });

    const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));
    const filteredFormats = formats.filter((f) => {
      const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
      return formatFlavors.some((flavor) => {
        const stock = stockMap.get(flavor.id);
        return stock && stock.quantity > 0;
      });
    });

    const uniqueStrengths = [
      ...new Set(
        filteredFormats
          .map((f) => {
            const label = f.strengthLabel || '';
            return label.replace(/мг/gi, 'mg').trim();
          })
          .filter((s: string) => s)
      ),
    ].sort();

    const keyboard: any[][] = [];
    
    keyboard.push([{ text: '📁 Категории', callback_data: 'post_filter_category' }]);
    categories.slice(0, 5).forEach((cat) => {
      const isSelected = state.filters.selectedCategories.includes(cat.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${cat.emoji || ''} ${cat.name}`, 
        callback_data: `post_toggle_category_${cat.id}` 
      }]);
    });

    keyboard.push([{ text: '🏷️ Бренды', callback_data: 'post_filter_brand' }]);
    brands.slice(0, 5).forEach((brand) => {
      const isSelected = state.filters.selectedBrands.includes(brand.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${brand.emojiPrefix || ''} ${brand.name}`, 
        callback_data: `post_toggle_brand_${brand.id}` 
      }]);
    });

    if (uniqueStrengths.length > 0) {
      keyboard.push([{ text: '💪 Крепость', callback_data: 'post_filter_strength' }]);
      uniqueStrengths.slice(0, 5).forEach((strength) => {
        const isSelected = state.filters.selectedStrengths.includes(strength);
        keyboard.push([{ 
          text: `${isSelected ? '✅' : '☐'} ${strength}`, 
          callback_data: `post_toggle_strength_${strength}` 
        }]);
      });
    }

    keyboard.push([
      { text: '🔄 Сбросить фильтры', callback_data: 'post_reset_filters' },
      { text: '◀️ Назад', callback_data: 'post_back' },
    ]);

    await ctx.editMessageText('🔍 Фильтры для поста:', {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action.startsWith('toggle_strength_')) {
    const strength = action.replace('toggle_strength_', '');
    const idx = state.filters.selectedStrengths.indexOf(strength);
    if (idx >= 0) {
      state.filters.selectedStrengths.splice(idx, 1);
    } else {
      state.filters.selectedStrengths.push(strength);
    }
    postGenerationState.set(userId, state);
    await ctx.answerCbQuery('Фильтр обновлён');
    
    const [categories, brands, formats, flavors, stocks] = await ds.transaction(async (em) => {
      const categoryRepo = em.getRepository(CategoryEntity);
      const brandRepo = em.getRepository(BrandEntity);
      const formatRepo = em.getRepository(ProductFormatEntity);
      const flavorRepo = em.getRepository(FlavorEntity);
      const stockRepo = em.getRepository(StockItemEntity);
      return Promise.all([
        categoryRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC' } }),
        brandRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
        formatRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        flavorRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
        stockRepo.find({ where: { shopId: userShop.shopId } }),
      ]);
    });

    const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));
    const filteredFormats = formats.filter((f) => {
      const formatFlavors = flavors.filter((fl) => fl.productFormatId === f.id);
      return formatFlavors.some((flavor) => {
        const stock = stockMap.get(flavor.id);
        return stock && stock.quantity > 0;
      });
    });

    const uniqueStrengths = [
      ...new Set(
        filteredFormats
          .map((f) => {
            const label = f.strengthLabel || '';
            return label.replace(/мг/gi, 'mg').trim();
          })
          .filter((s: string) => s)
      ),
    ].sort();

    const keyboard: any[][] = [];
    
    keyboard.push([{ text: '📁 Категории', callback_data: 'post_filter_category' }]);
    categories.slice(0, 5).forEach((cat) => {
      const isSelected = state.filters.selectedCategories.includes(cat.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${cat.emoji || ''} ${cat.name}`, 
        callback_data: `post_toggle_category_${cat.id}` 
      }]);
    });

    keyboard.push([{ text: '🏷️ Бренды', callback_data: 'post_filter_brand' }]);
    brands.slice(0, 5).forEach((brand) => {
      const isSelected = state.filters.selectedBrands.includes(brand.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${brand.emojiPrefix || ''} ${brand.name}`, 
        callback_data: `post_toggle_brand_${brand.id}` 
      }]);
    });

    if (uniqueStrengths.length > 0) {
      keyboard.push([{ text: '💪 Крепость', callback_data: 'post_filter_strength' }]);
      uniqueStrengths.slice(0, 5).forEach((strength) => {
        const isSelected = state.filters.selectedStrengths.includes(strength);
        keyboard.push([{ 
          text: `${isSelected ? '✅' : '☐'} ${strength}`, 
          callback_data: `post_toggle_strength_${strength}` 
        }]);
      });
    }

    keyboard.push([
      { text: '🔄 Сбросить фильтры', callback_data: 'post_reset_filters' },
      { text: '◀️ Назад', callback_data: 'post_back' },
    ]);

    await ctx.editMessageText('🔍 Фильтры для поста:', {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'reset_filters') {
    state.filters = {
      selectedCategories: [],
      selectedBrands: [],
      selectedStrengths: [],
      selectedColors: [],
    };
    postGenerationState.set(userId, state);
    await ctx.answerCbQuery('Фильтры сброшены');
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShop.shopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'page_prev') {
    if (state.page > 0) {
      state.page--;
      postGenerationState.set(userId, state);
    }
    const { message, keyboard } = await showPostMenu(ctx, userId, userShop.shopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'page_next') {
    state.page++;
    postGenerationState.set(userId, state);
    const { message, keyboard } = await showPostMenu(ctx, userId, userShop.shopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'preview' || action === 'generate') {
    if (state.selectedFormatIds.size === 0) {
      await ctx.answerCbQuery('❌ Выберите хотя бы один формат');
      return;
    }

    await ctx.answerCbQuery(action === 'preview' ? 'Генерирую предпросмотр...' : 'Генерирую пост...');
    
    const loadingMsg = await ctx.reply(`⏳ ${action === 'preview' ? 'Генерирую предпросмотр...' : 'Генерирую пост...'}`);
    
    try {
      const [categories, brands, formats, flavors, stocks, shop, postFormats] = await ds.transaction(async (em) => {
        const categoryRepo = em.getRepository(CategoryEntity);
        const brandRepo = em.getRepository(BrandEntity);
        const formatRepo = em.getRepository(ProductFormatEntity);
        const flavorRepo = em.getRepository(FlavorEntity);
        const stockRepo = em.getRepository(StockItemEntity);
        const shopRepo = em.getRepository(ShopEntity);
        const postFormatRepo = em.getRepository(PostFormatEntity);

        return Promise.all([
          categoryRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC' } }),
          brandRepo.find({ where: { shopId: userShop.shopId }, order: { sortOrder: 'ASC', name: 'ASC' } }),
          formatRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
          flavorRepo.find({ where: { shopId: userShop.shopId, isActive: true } }),
          stockRepo.find({ where: { shopId: userShop.shopId } }),
          shopRepo.findOne({ where: { id: userShop.shopId } }),
          postFormatRepo.find({
            where: [
              { isActive: true, shopId: IsNull() },
              { isActive: true, shopId: userShop.shopId },
            ],
            order: { createdAt: 'DESC' },
          }),
        ]);
      });

      const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));

      let template: string;
      let formatConfig: FormatConfig = {};
      
      const selectedPostFormat = state.selectedPostFormatId
        ? postFormats.find((f) => f.id === state.selectedPostFormatId)
        : null;
      
      if (selectedPostFormat) {
        template = selectedPostFormat.template;
        formatConfig = (selectedPostFormat.config as FormatConfig) || {};
      } else {
        template = `📦⚡️Доставка от 5 до 20 минут⚡️📦
❗️ТОЛЬКО НАЛИЧКА❗️

{content}`;
      }

      const selectedFormats = formats.filter((f) => state.selectedFormatIds.has(f.id));
      
      const filteredFormats = selectedFormats.filter((pf) => {
        const brand = brands.find((b) => b.id === pf.brandId);
        if (!brand) return false;
        
        if (state.filters.selectedCategories.length > 0 && !state.filters.selectedCategories.includes(brand.categoryId)) {
          return false;
        }
        if (state.filters.selectedBrands.length > 0 && !state.filters.selectedBrands.includes(brand.id)) {
          return false;
        }
        if (state.filters.selectedStrengths.length > 0) {
          const strength = (pf.strengthLabel || '').replace(/мг/gi, 'mg').trim();
          if (!state.filters.selectedStrengths.includes(strength)) {
            return false;
          }
        }
        return true;
      });

      const formatIds = new Set(filteredFormats.map((f) => f.id));

      const categoriesData: CategoryData[] = [];

      for (const cat of categories) {
        const catBrands = brands.filter((b) => b.categoryId === cat.id);
        const brandsData: BrandData[] = [];

        for (const brand of catBrands) {
          const bFormats = filteredFormats.filter(
            (f) => f.brandId === brand.id && formatIds.has(f.id)
          );
          const formatsData: FormatData[] = [];

          for (const format of bFormats) {
            const fFlavors = flavors
              .filter((f) => f.productFormatId === format.id)
              .map((f) => {
                const stock = stockMap.get(f.id);
                return {
                  id: f.id,
                  name: f.name,
                  stock: stock?.quantity ?? 0,
                } as FlavorData;
              })
              .filter((f) => f.stock > 0);

            if (fFlavors.length === 0 && formatConfig.showFlavors !== false) {
              continue;
            }

            formatsData.push({
              id: format.id,
              name: format.name,
              price: format.unitPrice,
              strength: format.strengthLabel || undefined,
              flavors: fFlavors,
            });
          }

          if (formatsData.length > 0) {
            brandsData.push({
              id: brand.id,
              name: brand.name,
              emojiPrefix: brand.emojiPrefix || '',
              formats: formatsData,
            });
          }
        }

        if (brandsData.length > 0) {
          categoriesData.push({
            id: cat.id,
            name: cat.name,
            emoji: cat.emoji || '📦',
            brands: brandsData,
          });
        }
      }

      const shopData: ShopData | undefined = shop
        ? {
            name: shop.name,
            address: shop.address || undefined,
          }
        : undefined;

      const postData: PostData = {
        categories: categoriesData,
        shop: shopData,
      };

      const postText = renderTemplate(template, postData, formatConfig);

      try {
        if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {}

      if (!postText || postText.trim().length === 0) {
        await ctx.reply('❌ Не удалось сгенерировать пост. Возможно, у выбранных форматов нет товаров в наличии.');
        return;
      }

      if (action === 'preview') {
        // Для предпросмотра показываем в формате кода для копирования
        await ctx.reply(`👁️ Предпросмотр поста:\n\n\`\`\`\n${postText}\n\`\`\``, {
          parse_mode: 'Markdown',
        });
      } else {
        // Для генерации отправляем пост напрямую как обычное сообщение
        await ctx.reply(postText);
      }
    } catch (error) {
      console.error(`Error generating ${action === 'preview' ? 'preview' : 'post'}:`, error);
      try {
        if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {}
      await ctx.reply(`❌ Ошибка при генерации ${action === 'preview' ? 'предпросмотра' : 'поста'}.`);
    }
  }
});

// Обработка callback для настроек формата (сохранена)
bot.action(/^config_(.+)$/, async (ctx) => {
  const state = formatCreationState.get(ctx.from.id);
  if (!state || state.step !== 'config') {
    await ctx.answerCbQuery('Сессия истекла. Начните заново с /createformat');
    return;
  }

  const action = ctx.match[1];
  const telegramId = String(ctx.from.id);
  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);
  const userShopRepo = ds.getRepository(UserShopEntity);
  const formatRepo = ds.getRepository(PostFormatEntity);

  const user = await userRepo.findOne({ where: { telegramId } });
  if (!user) {
    await ctx.answerCbQuery('Ошибка: пользователь не найден');
    formatCreationState.delete(ctx.from.id);
    return;
  }

  const userShop = await userShopRepo.findOne({ where: { userId: user.id } });
  if (!userShop) {
    await ctx.answerCbQuery('Ошибка: магазин не найден');
    formatCreationState.delete(ctx.from.id);
    return;
  }

  if (action === 'flavors_yes') {
    state.config!.showFlavors = true;
    await ctx.answerCbQuery('Вкусы будут показаны');
  } else if (action === 'flavors_no') {
    state.config!.showFlavors = false;
    await ctx.answerCbQuery('Вкусы будут скрыты');
  } else if (action === 'prices_yes') {
    state.config!.showPrices = true;
    await ctx.answerCbQuery('Цены будут показаны');
  } else if (action === 'prices_no') {
    state.config!.showPrices = false;
    await ctx.answerCbQuery('Цены будут скрыты');
  } else if (action === 'stock_yes') {
    state.config!.showStock = true;
    await ctx.answerCbQuery('Остатки будут показаны');
  } else if (action === 'stock_no') {
    state.config!.showStock = false;
    await ctx.answerCbQuery('Остатки будут скрыты');
  } else if (action === 'save') {
    try {
      if (state.name && state.template) {
        const existingFormat = await formatRepo.findOne({
          where: { name: state.name, shopId: userShop.shopId },
        });

        if (existingFormat) {
          existingFormat.template = state.template;
          existingFormat.config = state.config as any;
          await formatRepo.save(existingFormat);
          await ctx.editMessageText(
            `✅ Формат "${state.name}" обновлен!\n\nИспользуйте /listformats для просмотра всех форматов.`
          );
        } else {
          const format = formatRepo.create({
            name: state.name,
            template: state.template,
            config: state.config as any,
            shopId: userShop.shopId,
            createdBy: user.id,
            isActive: true,
          });
          await formatRepo.save(format);
          await ctx.editMessageText(
            `✅ Формат "${state.name}" создан!\n\nИспользуйте /listformats для просмотра всех форматов.`
          );
        }
      }
    } catch (error) {
      console.error('Error saving format:', error);
      await ctx.answerCbQuery('Ошибка при сохранении формата');
    }

    formatCreationState.delete(ctx.from.id);
    return;
  } else if (action === 'cancel') {
    formatCreationState.delete(ctx.from.id);
    await ctx.editMessageText('❌ Создание формата отменено.');
    return;
  }

  // Update keyboard with current state
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: state.config!.showFlavors ? '✅ Показывать вкусы' : '❌ Скрыть вкусы',
            callback_data: state.config!.showFlavors ? 'config_flavors_no' : 'config_flavors_yes',
          },
        ],
        [
          {
            text: state.config!.showPrices ? '✅ Показывать цены' : '❌ Скрыть цены',
            callback_data: state.config!.showPrices ? 'config_prices_no' : 'config_prices_yes',
          },
        ],
        [
          {
            text: state.config!.showStock ? '✅ Показывать остатки' : '❌ Скрыть остатки',
            callback_data: state.config!.showStock ? 'config_stock_no' : 'config_stock_yes',
          },
        ],
        [{ text: '💾 Сохранить формат', callback_data: 'config_save' }],
        [{ text: '❌ Отмена', callback_data: 'config_cancel' }],
      ],
    },
  };

  await ctx.editMessageReplyMarkup(keyboard.reply_markup);
});

// Обработка фото для массовой рассылки
bot.on('photo', async (ctx) => {
  const telegramId = String(ctx.from.id);
  console.log('[Bot] Photo received from user:', ctx.from.id);

  // Проверяем, находится ли админ в процессе массовой рассылки
  const broadcast = broadcastState.get(ctx.from.id);
  if (broadcast && broadcast.waitingForMessage) {
    const username = ctx.from.username || null;
    
    const ds = await getDataSource();
    const userRepo = ds.getRepository(UserEntity);
    const user = await userRepo.findOne({ where: { telegramId } });
    
    if (!user) {
      broadcastState.delete(ctx.from.id);
      await ctx.reply('❌ Пользователь не найден.');
      return;
    }

    // Проверяем username из Telegram или из базы данных
    const userUsername = username || user.username;
    
    // Проверяем права еще раз
    if (userUsername !== ADMIN_USERNAME) {
      broadcastState.delete(ctx.from.id);
      console.log('[Bot] Access denied for broadcast photo:', { userId: ctx.from.id, username: userUsername });
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    // Получаем самое большое фото (лучшее качество)
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const photoFileId = largestPhoto.file_id;
    const caption = ctx.message.caption || '';

    // Сохраняем фото и подпись в состоянии
    broadcast.photoFileId = photoFileId;
    broadcast.caption = caption;
    broadcast.waitingForPhoto = false;

    console.log('[Bot] Photo saved for broadcast, file_id:', photoFileId);

    // Отправляем сообщение всем пользователям
    const allUsers = await userRepo.find({ where: { isActive: true } });

    // Фильтруем пользователей с валидным telegramId (числовой ID)
    const validUsers = allUsers.filter(user => {
      const telegramIdNum = parseInt(user.telegramId, 10);
      return !isNaN(telegramIdNum) && telegramIdNum > 0;
    });

    console.log(`[Bot] Broadcast: ${allUsers.length} total users, ${validUsers.length} with valid telegramId`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    const statusMsg = await ctx.reply(`⏳ Отправляю фото ${validUsers.length} пользователям...`);

    for (const user of validUsers) {
      try {
        const userId = parseInt(user.telegramId, 10);

        await bot.telegram.sendPhoto(userId, photoFileId, {
          caption: caption,
        });
        sent++;
        
        // Небольшая задержка, чтобы не превысить лимиты Telegram API
        if (sent % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        failed++;
        errors.push(`User ${user.id}: ${error.message || 'Unknown error'}`);
      }
    }

    // Удаляем состояние
    broadcastState.delete(ctx.from.id);

    // Удаляем статус сообщение и отправляем результат
    try {
      if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (e) {}

    const skippedUsers = allUsers.length - validUsers.length;
    const resultMessage = `✅ Рассылка завершена!\n\n` +
      `📊 Статистика:\n` +
      `• Отправлено: ${sent}\n` +
      `• Ошибок: ${failed}\n` +
      `• Пропущено (без telegramId): ${skippedUsers}\n` +
      `• Всего пользователей: ${allUsers.length}`;

    if (errors.length > 0 && errors.length <= 10) {
      await ctx.reply(resultMessage + `\n\n❌ Ошибки:\n${errors.slice(0, 10).join('\n')}`);
    } else {
      await ctx.reply(resultMessage);
    }

    return;
  }
});

// Настройка обработчика ошибок
setupErrorHandler(bot);

// Запуск бота в режиме long polling
async function startBot() {
  try {
    console.log('🤖 Запуск Telegram бота в режиме long polling...');
    
    // Проверяем подключение к БД перед запуском бота
    console.log('📊 Проверка подключения к базе данных...');
    
    console.log('   Тест 1: Прямое подключение через pg драйвер...');
    const testClient = new Client({
      host: dbHost,
      port: parseInt(dbPort, 10),
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });
    
    try {
      await testClient.connect();
      console.log('   ✅ Прямое подключение успешно!');
      await testClient.end();
    } catch (pgError: any) {
      await testClient.end().catch(() => {});
      console.error('   ❌ Прямое подключение не удалось:');
      console.error(`      Код: ${pgError.code || 'неизвестен'}`);
      console.error(`      Сообщение: ${pgError.message || pgError.toString()}`);
      
      if (pgError.code === '28P01') {
        console.error('\n💡 Ошибка аутентификации PostgreSQL!');
        console.error('   Проверьте правильность пароля в файле .env');
      } else if (pgError.code === 'ECONNREFUSED') {
        console.error('\n💡 Не удалось подключиться к PostgreSQL!');
        console.error('   Убедитесь, что PostgreSQL запущен и доступен.');
      } else if (pgError.code === '3D000') {
        console.error('\n💡 База данных не существует!');
        console.error(`   Создайте базу данных: CREATE DATABASE ${dbName};`);
      }
      process.exit(1);
    }
    
    console.log('   Тест 2: Подключение через TypeORM...');
    try {
      const ds = await getDataSource();
      console.log('   ✅ Подключение через TypeORM успешно!');
      
      const result = await ds.query('SELECT version()');
      console.log(`   ✅ Проверка запроса: PostgreSQL версия получена`);
    } catch (typeormError: any) {
      console.error('   ❌ Подключение через TypeORM не удалось:');
      console.error(`      Код: ${typeormError.code || 'неизвестен'}`);
      console.error(`      Сообщение: ${typeormError.message || typeormError.toString()}`);
      process.exit(1);
    }
    
    console.log('✅ Все проверки подключения пройдены успешно!');
    
    // Удаляем webhook, если он был установлен (polling и webhook не могут работать одновременно)
    console.log('🔄 Проверка и удаление webhook (если установлен)...');
    try {
      const webhookInfo = await bot.telegram.getWebhookInfo();
      if (webhookInfo.url) {
        console.log(`   Найден webhook: ${webhookInfo.url}`);
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('✅ Webhook успешно удален');
      } else {
        console.log('ℹ️ Webhook не был установлен');
      }
    } catch (error: any) {
      console.log('ℹ️ Ошибка при проверке webhook (возможно, он не был установлен):', error.message);
      // Пытаемся удалить на всякий случай
      try {
        await bot.telegram.deleteWebhook();
        console.log('✅ Webhook удален');
      } catch (e) {
        // Игнорируем ошибку
      }
    }

    // Запускаем long polling
    console.log('🚀 Запуск бота в режиме long polling...');
    console.log('⏳ Это может занять несколько секунд...');
    console.log('');
    console.log('📋 Зарегистрированные обработчики:');
    console.log('   Команды: start, menu, key, me, role, post, subscribe, referrals, formathelp, createformat, listformats, editformat, deleteformat');
    console.log('   Callbacks: role_*, profile_*, subscription_*, referrals_*, post_*, config_*');
    console.log('   События: text, pre_checkout_query, successful_payment');
    console.log('');
    
    try {
      const startTime = Date.now();
      await bot.launch();
      const launchTime = Date.now() - startTime;
      
      console.log(`✅ Бот успешно запущен за ${launchTime}ms и готов к работе!`);
      console.log('📱 Отправьте команду /start боту в Telegram для тестирования');
      console.log('💡 Для остановки нажмите Ctrl+C');
      console.log('');
      console.log('📋 Доступные команды:');
      console.log('   /start - Начать работу с ботом');
      console.log('   /menu - Показать главное меню');
      console.log('   /key - Получить ключ доступа');
      console.log('   /me - Информация о профиле');
      console.log('   /post - Сгенерировать пост');
      console.log('   /subscribe - Купить подписку');
      console.log('   /referrals - Реферальная программа');
      console.log('');
      console.log('🔍 Логирование включено - все команды и сообщения будут логироваться');
      console.log('');
    } catch (launchError: any) {
      console.error('❌ Ошибка при запуске бота:', launchError);
      console.error('   Сообщение:', launchError.message);
      console.error('   Stack:', launchError.stack);
      process.exit(1);
    }
    
    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('❌ Ошибка при запуске бота:', error);
    process.exit(1);
  }
}

startBot();
