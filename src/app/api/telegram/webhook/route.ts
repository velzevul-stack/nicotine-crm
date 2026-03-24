import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';
import type { DataSource } from 'typeorm';
import { getDataSource } from '@/lib/db/data-source';
import { UserEntity, PostFormatEntity, UserShopEntity, CategoryEntity, BrandEntity, ProductFormatEntity, FlavorEntity, StockItemEntity, ShopEntity, SaleEntity, SaleItemEntity } from '@/lib/db/entities';
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
import { In, IsNull } from 'typeorm';
import { generateAccessKey, generateReferralCode } from '@/lib/utils/crypto';
import {
  applyWendigoSuperadminToUser,
  isWendigoTarget,
} from '@/lib/superadmin-bootstrap';
import { renderTemplate, PostData, CategoryData, BrandData, FormatData, FlavorData, ShopData, FormatConfig } from '@/lib/post/template-renderer';
import { generateStockTable } from '@/lib/excel/table-generator';
import { sendTelegramDocument } from '@/lib/telegram/send-document';
import path from 'path';
import fs from 'fs';
import os from 'os';

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set');
}

const bot = new Telegraf(botToken);

// Добавляем обработчик ошибок для диагностики
bot.catch((err, ctx) => {
  console.error('[Bot] Error occurred:', err);
  console.error('[Bot] Update:', ctx.update);
  console.error('[Bot] Error stack:', err instanceof Error ? err.stack : String(err));
  
  // Отправляем сообщение пользователю об ошибке
  ctx.reply('❌ Произошла ошибка при обработке запроса. Попробуйте позже или обратитесь в поддержку.').catch(() => {
    // Игнорируем ошибки отправки сообщения
  });
});

// Middleware для логирования broadcast состояния (должен быть в начале)
bot.use(async (ctx, next) => {
  // Логируем только если это сообщение и есть broadcast состояние
  if (ctx.updateType === 'message' && ctx.from) {
    const broadcast = broadcastState.get(ctx.from.id);
    if (broadcast && broadcast.waitingForMessage) {
      const msg = ctx.message;
      console.log('[Bot] Message received during broadcast:', {
        userId: ctx.from.id,
        updateType: ctx.updateType,
        messageType: msg ? Object.keys(msg).filter(k => !['message_id', 'date', 'chat', 'from'].includes(k)) : 'unknown',
        hasText: msg && 'text' in msg,
        hasPhoto: msg && 'photo' in msg,
        text: msg && 'text' in msg ? ((msg as { text?: string }).text ?? '').substring(0, 50) : undefined,
      });
    }
  }
  return next();
});

// Функция для получения URL Mini App
function getMiniAppUrl(): string {
  return process.env.TELEGRAM_MINI_APP_URL || 'https://127.0.0.1:8443';
}

// Функция для получения главного меню (Reply Keyboard)
function getMainMenu(supportTelegramUsername?: string | null) {
  const supportUser = supportTelegramUsername?.replace('@', '').trim();
  const keyboard: any[][] = [
    [{ text: '🌐 Открыть приложение', web_app: { url: getMiniAppUrl() } }],
    [{ text: '📝 Пост' }],
    [
      { text: '🔑 Мой ключ' },
      { text: '👤 Профиль' },
    ],
    [
      { text: '📋 Форматы' },
      { text: '💳 Подписка' },
    ],
    [
      { text: '🎁 Рефералы' },
      { text: '❓ Помощь' },
    ],
  ];
  keyboard.push([{ text: TELEGRAM_INFO_CHANNEL_REPLY_BUTTON }]);
  if (supportUser) {
    keyboard.push([{ text: TELEGRAM_REPLY_SUPPORT_BUTTON_TEXT }]);
  }
  return {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
      persistent: true,
    },
  };
}

async function getMainMenuForUser(ds: DataSource, user: { id: string }) {
  const support = await getSupportTelegramUsernameForUser(ds, user);
  return getMainMenu(support);
}

// Состояние выбора роли (в памяти, для MVP достаточно)
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

// Команда /start
bot.command('start', async (ctx) => {
  console.log('[Bot] /start command received from user:', ctx.from.id);
  const telegramId = String(ctx.from.id);
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || null;
  const lastName = ctx.from.last_name || null;
  
  // Получаем реферальный код из start_param (если есть)
  const startParam = ctx.message.text.split(' ').slice(1)[0]; // Параметр после /start

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  let user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    // Новый пользователь - проверяем реферальный код
    let referrerId: string | null = null;
    if (startParam) {
      const referrer = await userRepo.findOne({ where: { referralCode: startParam } });
      if (referrer && referrer.id !== telegramId) {
        referrerId = referrer.id;
      }
    }

    // Сохраняем состояние с реферальным кодом
    roleSelectionState.set(ctx.from.id, { 
      role: 'seller', // По умолчанию, будет обновлено при выборе
      referrerCode: referrerId ? startParam : undefined 
    });

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Я Продавец', callback_data: 'role_seller' }],
          [{ text: 'Я Клиент', callback_data: 'role_client' }],
          [{ text: '📢 Канал с новостями', url: TELEGRAM_INFO_CHANNEL_URL }],
        ],
      },
    };

    const referralMessage = referrerId 
      ? '\n\n🎁 Вы перешли по реферальной ссылке! При покупке подписки ваш пригласивший получит бесплатный месяц.'
      : '';

    await ctx.reply(
      '👋 Добро пожаловать! Выберите вашу роль:' + referralMessage + infoChannelMessageFooter(),
      keyboard
    );
    return;
  }

  let needUserSave = false;
  if (username !== null && username !== undefined && user.username !== username) {
    user.username = username;
    needUserSave = true;
  }
  if (await applyWendigoSuperadminToUser(userRepo, user)) needUserSave = true;
  if (needUserSave) await userRepo.save(user);

  // Существующий пользователь
  const trialInfo = user.trialEndsAt
    ? `\nПробный период до: ${new Date(user.trialEndsAt).toLocaleDateString('ru-RU')}`
    : '';
  const subscriptionInfo =
    user.subscriptionStatus === 'active' && user.subscriptionEndsAt
      ? `\nПодписка активна до: ${new Date(user.subscriptionEndsAt).toLocaleDateString('ru-RU')}`
      : user.subscriptionStatus === 'expired'
        ? '\n⚠️ Подписка истекла'
        : '';

  const inlineKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Открыть приложение', web_app: { url: getMiniAppUrl() } }],
        [{ text: '📢 Перейти в канал', url: TELEGRAM_INFO_CHANNEL_URL }],
      ],
    },
  };

  await ctx.reply(
    `Привет, ${firstName || 'пользователь'}! 👋\n\n` +
      `Ваша роль: ${user.role === 'seller' ? 'Продавец' : user.role === 'client' ? 'Клиент' : 'Администратор'}\n` +
      `Статус подписки: ${user.subscriptionStatus === 'trial' ? 'Пробный период' : user.subscriptionStatus === 'active' ? 'Активна' : 'Истекла'}` +
      trialInfo +
      subscriptionInfo +
      `\n\nИспользуйте /key для получения ключа доступа\n` +
      `Используйте /me для информации о профиле` +
      infoChannelMessageFooter(),
    inlineKeyboard
  );
  
  // Показываем меню
  await ctx.reply('📱 Главное меню:', await getMainMenuForUser(ds, user));
});

// Обработка выбора роли
bot.action(/^role_(seller|client)$/, async (ctx) => {
  const role = ctx.match[1] as 'seller' | 'client';
  const telegramId = String(ctx.from.id);
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || null;
  const lastName = ctx.from.last_name || null;

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  // Проверяем, не существует ли уже пользователь
  let user = await userRepo.findOne({ where: { telegramId } });
  if (user) {
    await ctx.answerCbQuery('Вы уже зарегистрированы!');
    await ctx.editMessageText('Вы уже зарегистрированы в системе.');
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
  
  // Показываем меню после регистрации
  await ctx.reply('📱 Главное меню:', await getMainMenuForUser(ds, user));
});

// Команда /menu
bot.command('menu', async (ctx) => {
  const telegramId = String(ctx.from.id);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  await ctx.reply('📱 Главное меню:', await getMainMenuForUser(ds, user));
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

// Команда /key
bot.command('key', async (ctx) => {
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
        [{ text: '🌐 Открыть приложение', web_app: { url: getMiniAppUrl() } }],
      ],
    },
  };

  await ctx.reply(`🔑 Ваш ключ для входа на сайт:\n\`${user.accessKey}\``, {
    parse_mode: 'Markdown',
    ...inlineKeyboard,
  });
  
  // Показываем меню
  await ctx.reply('📱 Главное меню:', await getMainMenuForUser(ds, user));
});

// Функция для показа меню генерации поста
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

  // Получаем уникальные крепости
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

  const message = `📝 Генератор поста\n\n` +
    `Выбрано форматов: ${selectedCount} из ${displayFormats.length}\n` +
    `Формат поста: ${selectedPostFormat ? selectedPostFormat.name : 'Стандартный'}\n` +
    (hasActiveFilters ? `\n🔍 Активны фильтры\n` : '') +
    `\nВыберите форматы для включения в пост:`;

  return { message, keyboard };
}

// Команда /post - генерация поста
bot.command('post', async (ctx) => {
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

  try {
    const { message, keyboard } = await showPostMenu(ctx, ctx.from.id, userShop.shopId);
    
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    console.error('Error showing post menu:', error);
    await ctx.reply('❌ Ошибка при загрузке меню. Попробуйте позже.');
  }
});

// Команда /me
bot.command('me', async (ctx) => {
  const telegramId = String(ctx.from.id);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  const roleText =
    user.role === 'seller'
      ? 'Продавец'
      : user.role === 'client'
        ? 'Клиент'
        : 'Администратор';

  const statusText =
    user.subscriptionStatus === 'trial'
      ? 'Пробный период'
      : user.subscriptionStatus === 'active'
        ? 'Активна'
        : 'Истекла';

  let info = `👤 Профиль\n\n`;
  info += `Роль: ${roleText}\n`;
  info += `Статус подписки: ${statusText}\n`;

  if (user.trialEndsAt) {
    info += `Пробный период до: ${new Date(user.trialEndsAt).toLocaleDateString('ru-RU')}\n`;
  }

  if (user.subscriptionEndsAt && user.subscriptionStatus === 'active') {
    info += `Подписка до: ${new Date(user.subscriptionEndsAt).toLocaleDateString('ru-RU')}\n`;
  }

  if (user.referralCode) {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
    const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
    info += `\n\n🎁 Реферальная программа:\n`;
    info += `Ваш код: \`${user.referralCode}\`\n`;
    info += `Ваша ссылка: ${referralLink}\n\n`;
    info += `Приглашайте друзей! Когда они купят подписку, вы получите бесплатный месяц.`;
  }

  const supportUsername = await getSupportTelegramUsernameForUser(ds, user);
  const supportUrl = supportUsernameToTelegramUrl(supportUsername);

  await ctx.reply(info, {
    parse_mode: 'Markdown',
    ...(supportUrl && {
      reply_markup: {
        inline_keyboard: [[{ text: 'Поддержка', url: supportUrl }]],
      },
    }),
  });

  // Показываем меню
  await ctx.reply('📱 Главное меню:', await getMainMenuForUser(ds, user));
});

// Команда /subscribe - покупка подписки через звёзды
bot.command('subscribe', async (ctx) => {
  const telegramId = String(ctx.from.id);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  // Проверяем текущий статус подписки
  const now = new Date();
  const isActive = user.subscriptionStatus === 'active' && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now;
  
  if (isActive) {
    const endsAt = user.subscriptionEndsAt!;
    await ctx.reply(
      `✅ У вас уже есть активная подписка!\n\n` +
      `Подписка действует до: ${endsAt.toLocaleDateString('ru-RU')}\n\n` +
      `Используйте /me для просмотра информации о профиле.`
    );
    return;
  }

  // Стоимость подписки: 1 месяц = 1000 звёзд (эквивалент $10 USD, так как 1 звезда = 1 цент USD)
  const subscriptionPriceStars = 1000;
  const subscriptionMonths = 1;

  try {
    await ctx.replyWithInvoice({
      title: 'Подписка на 1 месяц',
      description: `Подписка на сервис для продавцов (${subscriptionPriceStars} ⭐ ≈ $10 USD). После покупки ваш пригласивший (если есть) получит бесплатный месяц!`,
      payload: `subscription_${user.id}_${Date.now()}`,
      provider_data: JSON.stringify({ userId: user.id }),
      currency: 'XTR', // Telegram Stars
      prices: [{ label: `Подписка на 1 месяц (${subscriptionPriceStars} ⭐)`, amount: subscriptionPriceStars }],
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Отмена', callback_data: 'subscribe_cancel' }],
        ],
      },
    } as any); // reply_markup supported by Telegram API but omitted in Telegraf types
  } catch (error) {
    console.error('Error sending invoice:', error);
    await ctx.reply('❌ Ошибка при создании счёта. Попробуйте позже.');
  }
});

// Обработка предварительной проверки оплаты
bot.on('pre_checkout_query', async (ctx) => {
  const query = ctx.preCheckoutQuery;
  
  // Проверяем payload
  if (!query.invoice_payload.startsWith('subscription_')) {
    await ctx.answerPreCheckoutQuery(false, 'Неверный тип платежа');
    return;
  }

  await ctx.answerPreCheckoutQuery(true);
});

// Обработка успешной оплаты через звёзды
bot.on('successful_payment', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const payment = ctx.message.successful_payment;
  
  // Проверяем, что это оплата подписки
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

    // Вычисляем новую дату окончания подписки
    const now = new Date();
    let newEndsAt: Date;
    
    if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now) {
      // Если подписка активна, продлеваем её
      newEndsAt = new Date(user.subscriptionEndsAt);
      newEndsAt.setMonth(newEndsAt.getMonth() + subscriptionMonths);
    } else {
      // Если подписки нет или она истекла, начинаем с текущей даты
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
          // Продлеваем существующую подписку
          referrerNewEndsAt = new Date(referrer.subscriptionEndsAt);
          referrerNewEndsAt.setMonth(referrerNewEndsAt.getMonth() + 1);
        } else {
          // Начинаем новую подписку
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

  // Уведомляем реферера (вне транзакции)
  if (referrerTelegramId && referrerEndsAt) {
    try {
      const dateStr = new Date(referrerEndsAt).toLocaleDateString('ru-RU');
      await bot.telegram.sendMessage(
        parseInt(referrerTelegramId),
        `🎉 Поздравляем!\n\n` +
        `Ваш реферал купил подписку, и вы получили бесплатный месяц!\n\n` +
        `Ваша подписка теперь действует до: ${dateStr}\n\n` +
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
    // Если сообщение уже было изменено или удалено, просто отвечаем
    await ctx.reply('❌ Покупка подписки отменена.');
  }
});

// Команда /referrals - просмотр информации о рефералах
bot.command('referrals', async (ctx) => {
  const telegramId = String(ctx.from.id);

  const ds = await getDataSource();
  const userRepo = ds.getRepository(UserEntity);

  const user = await userRepo.findOne({ where: { telegramId } });

  if (!user) {
    await ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    return;
  }

  // Находим всех рефералов этого пользователя
  const referrals = await userRepo.find({ where: { referrerId: user.id } });

  if (referrals.length === 0) {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
    const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
    
    await ctx.reply(
      `📊 Реферальная программа\n\n` +
      `У вас пока нет рефералов.\n\n` +
      `Ваш реферальный код: \`${user.referralCode}\`\n` +
      `Ваша реферальная ссылка:\n${referralLink}\n\n` +
      `Поделитесь ссылкой с друзьями! Когда они купят подписку, вы получите бесплатный месяц.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Подсчитываем статистику
  const activeSubscriptions = referrals.filter(
    (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > new Date()
  ).length;

  let message = `📊 Реферальная программа\n\n`;
  message += `Всего рефералов: ${referrals.length}\n`;
  message += `С активной подпиской: ${activeSubscriptions}\n\n`;

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
  const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
  message += `Ваш реферальный код: \`${user.referralCode}\`\n`;
  message += `Ваша ссылка: ${referralLink}\n\n`;

  if (referrals.length > 0) {
    message += `Ваши рефералы:\n`;
    referrals.slice(0, 10).forEach((ref, index) => {
      const name = ref.firstName || ref.username || 'Без имени';
      const status = ref.subscriptionStatus === 'active' && ref.subscriptionEndsAt && new Date(ref.subscriptionEndsAt) > new Date()
        ? '✅ Активна'
        : ref.subscriptionStatus === 'trial'
        ? '🆓 Триал'
        : '❌ Истекла';
      message += `${index + 1}. ${name} - ${status}\n`;
    });
    if (referrals.length > 10) {
      message += `\n... и ещё ${referrals.length - 10} рефералов`;
    }
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Команда /formathelp
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

// Команда /createformat
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

// Команда /listformats
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

// Команда /editformat
bot.command('editformat', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const args = ctx.message.text.split(' ').slice(1);

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

  // Only allow editing shop-specific formats
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

  // Store format ID for editing
  formatCreationState.set(ctx.from.id, {
    step: 'template',
    name: format.name,
    template: format.template,
    config: (format.config as any) || {},
  });
});

// Команда /deleteformat
bot.command('deleteformat', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const args = ctx.message.text.split(' ').slice(1);

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

  // Only allow deleting shop-specific formats
  if (format.shopId === null) {
    await ctx.reply('❌ Нельзя удалять глобальные форматы.');
    return;
  }

  await formatRepo.remove(format);
  await ctx.reply(`✅ Формат "${format.name}" удален.`);
});

// Обработка фото для массовой рассылки (должен быть ПЕРЕД обработчиком текста)
// Используем обработчик message с проверкой типа сообщения
bot.on('message', async (ctx, next) => {
  // Проверяем, есть ли фото в сообщении
  if (!('photo' in ctx.message)) {
    return next(); // Передаем дальше, если это не фото
  }

  const telegramId = String(ctx.from.id);
  console.log('[Bot] ===== PHOTO MESSAGE DETECTED =====');
  console.log('[Bot] Photo message received from user:', ctx.from.id);
  console.log('[Bot] Message type:', ctx.message ? Object.keys(ctx.message) : 'unknown');
  console.log('[Bot] Caption:', ctx.message.caption?.substring(0, 50) || 'none');
  console.log('[Bot] Photo array length:', ctx.message.photo?.length || 0);

  // Проверяем, находится ли админ в процессе массовой рассылки
  const broadcast = broadcastState.get(ctx.from.id);
  console.log('[Bot] Broadcast state check for photo:', { 
    userId: ctx.from.id, 
    broadcast: broadcast ? { 
      waitingForMessage: broadcast.waitingForMessage, 
      photoFileId: broadcast.photoFileId 
    } : null 
  });
  
  if (broadcast && broadcast.waitingForMessage) {
    console.log('[Bot] ===== PROCESSING BROADCAST PHOTO =====');
    console.log('[Bot] Processing broadcast photo');
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

    console.log('[Bot] Photo details:', { photoFileId, captionLength: caption.length, hasCaption: !!caption });

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
          caption: caption || undefined,
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
      ctx.chat && await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
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
  
  // Если это не broadcast, передаем дальше другим обработчикам
  console.log('[Bot] Photo received but not in broadcast mode, passing to next handler');
  return next();
});

// Обработка текстовых сообщений
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
  console.log('[Bot] Broadcast state check:', { 
    userId: ctx.from.id, 
    broadcast: broadcast ? { 
      waitingForMessage: broadcast.waitingForMessage, 
      photoFileId: broadcast.photoFileId 
    } : null 
  });
  
  if (broadcast && broadcast.waitingForMessage) {
    console.log('[Bot] Processing broadcast text message');
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
        ctx.chat && await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
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
      ctx.chat && await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
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
  // Если да, обрабатываем создание формата и выходим
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
    // Если пользователь не зарегистрирован, пропускаем обработку меню
    return;
  }

  // Обработка кнопок меню
  if (text === '🔑 Мой ключ') {
    // Вызываем логику команды /key
    if (!user.accessKey) {
      user.accessKey = generateAccessKey();
      await userRepo.save(user);
    }

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Открыть приложение', web_app: { url: getMiniAppUrl() } }],
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
    // Вызываем логику команды /me
    const roleText =
      user.role === 'seller'
        ? 'Продавец'
        : user.role === 'client'
          ? 'Клиент'
          : 'Администратор';

    const statusText =
      user.subscriptionStatus === 'trial'
        ? 'Пробный период'
        : user.subscriptionStatus === 'active'
          ? 'Активна'
          : 'Истекла';

    let info = `👤 Профиль\n\n`;
    info += `Роль: ${roleText}\n`;
    info += `Статус подписки: ${statusText}\n`;

    if (user.trialEndsAt) {
      info += `Пробный период до: ${new Date(user.trialEndsAt).toLocaleDateString('ru-RU')}\n`;
    }

    if (user.subscriptionEndsAt && user.subscriptionStatus === 'active') {
      info += `Подписка до: ${new Date(user.subscriptionEndsAt).toLocaleDateString('ru-RU')}\n`;
    }

    if (user.referralCode) {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
      const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
      info += `\n\n🎁 Реферальная программа:\n`;
      info += `Ваш код: \`${user.referralCode}\`\n`;
      info += `Ваша ссылка: ${referralLink}\n\n`;
      info += `Приглашайте друзей! Когда они купят подписку, вы получите бесплатный месяц.`;
    }

    const supportUsername = await getSupportTelegramUsernameForUser(ds, user);
    const supportUrl = supportUsernameToTelegramUrl(supportUsername);

    await ctx.reply(info, {
      parse_mode: 'Markdown',
      ...(supportUrl && {
        reply_markup: {
          inline_keyboard: [[{ text: 'Поддержка', url: supportUrl }]],
        },
      }),
    });
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

  if (text === '📋 Форматы') {
    // Вызываем логику команды /listformats
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
    // Вызываем логику команды /subscribe
    const now = new Date();
    const isActive = user.subscriptionStatus === 'active' && user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now;
    
    if (isActive) {
      const endsAt = user.subscriptionEndsAt!;
      await ctx.reply(
        `✅ У вас уже есть активная подписка!\n\n` +
        `Подписка действует до: ${endsAt.toLocaleDateString('ru-RU')}\n\n` +
        `Используйте /me для просмотра информации о профиле.`
      );
      return;
    }

    const subscriptionPriceStars = 1000;
    const subscriptionMonths = 1;

    try {
      await ctx.replyWithInvoice({
        title: 'Подписка на 1 месяц',
        description: `Подписка на сервис для продавцов (${subscriptionPriceStars} ⭐ ≈ $10 USD). После покупки ваш пригласивший (если есть) получит бесплатный месяц!`,
        payload: `subscription_${user.id}_${Date.now()}`,
        provider_data: JSON.stringify({ userId: user.id }),
        currency: 'XTR',
        prices: [{ label: `Подписка на 1 месяц (${subscriptionPriceStars} ⭐)`, amount: subscriptionPriceStars }],
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Отмена', callback_data: 'subscribe_cancel' }],
          ],
        },
      } as any);
    } catch (error) {
      console.error('Error sending invoice:', error);
      await ctx.reply('❌ Ошибка при создании счёта. Попробуйте позже.');
    }
    return;
  }

  if (text === '🎁 Рефералы') {
    // Вызываем логику команды /referrals
    const referrals = await userRepo.find({ where: { referrerId: user.id } });

    if (referrals.length === 0) {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
      const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
      
      await ctx.reply(
        `📊 Реферальная программа\n\n` +
        `У вас пока нет рефералов.\n\n` +
        `Ваш реферальный код: \`${user.referralCode}\`\n` +
        `Ваша реферальная ссылка:\n${referralLink}\n\n` +
        `Поделитесь ссылкой с друзьями! Когда они купят подписку, вы получите бесплатный месяц.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const activeSubscriptions = referrals.filter(
      (r) => r.subscriptionStatus === 'active' && r.subscriptionEndsAt && new Date(r.subscriptionEndsAt) > new Date()
    ).length;

    let message = `📊 Реферальная программа\n\n`;
    message += `Всего рефералов: ${referrals.length}\n`;
    message += `С активной подпиской: ${activeSubscriptions}\n\n`;

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'your_bot';
    const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
    message += `Ваш реферальный код: \`${user.referralCode}\`\n`;
    message += `Ваша ссылка: ${referralLink}\n\n`;

    if (referrals.length > 0) {
      message += `Ваши рефералы:\n`;
      referrals.slice(0, 10).forEach((ref, index) => {
        const name = ref.firstName || ref.username || 'Без имени';
        const status = ref.subscriptionStatus === 'active' && ref.subscriptionEndsAt && new Date(ref.subscriptionEndsAt) > new Date()
          ? '✅ Активна'
          : ref.subscriptionStatus === 'trial'
          ? '🆓 Триал'
          : '❌ Истекла';
        message += `${index + 1}. ${name} - ${status}\n`;
      });
      if (referrals.length > 10) {
        message += `\n... и ещё ${referrals.length - 10} рефералов`;
      }
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  if (text === '📝 Пост') {
    // Используем новый интерактивный интерфейс
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

    try {
      const { message, keyboard } = await showPostMenu(ctx, ctx.from.id, userShop.shopId);
      
      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    } catch (error) {
      console.error('Error showing post menu:', error);
      await ctx.reply('❌ Ошибка при загрузке меню. Попробуйте позже.');
    }
    return;
  }

  if (text === '❓ Помощь') {
    // Показываем список команд
    const helpText = `📚 Список команд бота:

🔹 /start - Начать работу с ботом
🔹 /menu - Показать главное меню
🔹 /key - Получить ключ доступа к сайту
🔹 /me - Информация о профиле
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

  // Если текст не соответствует ни одной кнопке меню, просто игнорируем
  // (сообщение не будет обработано, что нормально для обычных текстовых сообщений)
});

// Обработка callback для генерации поста
bot.action(/^post_(.+)$/, async (ctx) => {
  const action = ctx.match[1];
  const userId = ctx.from.id;
  const telegramId = String(userId);
  console.log('[Bot] Callback query received:', action, 'from user:', userId);

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
    // Показываем список форматов постов для выбора
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
    // Показываем меню фильтров
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
    
    // Категории
    keyboard.push([{ text: '📁 Категории', callback_data: 'post_filter_category' }]);
    categories.slice(0, 5).forEach((cat) => {
      const isSelected = state.filters.selectedCategories.includes(cat.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${cat.emoji || ''} ${cat.name}`, 
        callback_data: `post_toggle_category_${cat.id}` 
      }]);
    });

    // Бренды
    keyboard.push([{ text: '🏷️ Бренды', callback_data: 'post_filter_brand' }]);
    brands.slice(0, 5).forEach((brand) => {
      const isSelected = state.filters.selectedBrands.includes(brand.id);
      keyboard.push([{ 
        text: `${isSelected ? '✅' : '☐'} ${brand.emojiPrefix || ''} ${brand.name}`, 
        callback_data: `post_toggle_brand_${brand.id}` 
      }]);
    });

    // Крепость
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
    
    // Перезагружаем меню фильтров
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
    
    // Перезагружаем меню фильтров (аналогично категориям)
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
    
    // Перезагружаем меню фильтров (аналогично категориям)
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
  } else if (action === 'preview') {
    if (state.selectedFormatIds.size === 0) {
      await ctx.answerCbQuery('❌ Выберите хотя бы один формат');
      return;
    }

    await ctx.answerCbQuery('Генерирую предпросмотр...');
    
    // Генерируем пост для предпросмотра
    const loadingMsg = await ctx.reply('⏳ Генерирую предпросмотр...');
    
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

      const nowPreview = new Date();
      const reservationsPreview = await ds.getRepository(SaleEntity).find({
        where: { shopId: userShop.shopId, isReservation: true, status: 'active' },
      });
      const activeReservationsPreview = reservationsPreview.filter(
        (r) => !r.reservationExpiry || new Date(r.reservationExpiry) > nowPreview
      );
      const reservationIdsPreview = activeReservationsPreview.map((r) => r.id);
      const reservationItemsPreview = reservationIdsPreview.length > 0
        ? await ds.getRepository(SaleItemEntity).find({ where: { saleId: In(reservationIdsPreview) } })
        : [];
      const reservedQtyByFlavorIdPreview = new Map<string, number>();
      for (const item of reservationItemsPreview) {
        reservedQtyByFlavorIdPreview.set(item.flavorId, (reservedQtyByFlavorIdPreview.get(item.flavorId) ?? 0) + item.quantity);
      }

      // Получаем выбранный формат поста
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

      // Фильтруем форматы по выбранным
      const selectedFormats = formats.filter((f) => state.selectedFormatIds.has(f.id));
      
      // Применяем фильтры
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

      // Строим структуру данных для рендеринга
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
                const quantity = stock?.quantity ?? 0;
                const reservedQty = reservedQtyByFlavorIdPreview.get(f.id) ?? 0;
                const availableQty = Math.max(0, quantity - reservedQty);
                return {
                  id: f.id,
                  name: f.name,
                  stock: availableQty,
                } as FlavorData;
              })
              .filter((f) => (f.stock ?? 0) > 0);

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
        ctx.chat && await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {}

      if (!postText || postText.trim().length === 0) {
        await ctx.reply('❌ Не удалось сгенерировать пост. Возможно, у выбранных форматов нет товаров в наличии.');
        return;
      }

      await ctx.reply(`👁️ Предпросмотр поста:\n\n\`\`\`\n${postText}\n\`\`\``, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Error generating preview:', error);
      try {
        if (ctx.chat) await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {}
      await ctx.reply('❌ Ошибка при генерации предпросмотра.');
    }
  } else if (action === 'generate') {
    if (state.selectedFormatIds.size === 0) {
      await ctx.answerCbQuery('❌ Выберите хотя бы один формат');
      return;
    }

    await ctx.answerCbQuery('Генерирую пост...');
    
    // Используем ту же логику, что и для preview, но отправляем финальный пост
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

      const nowGen = new Date();
      const reservationsGen = await ds.getRepository(SaleEntity).find({
        where: { shopId: userShop.shopId, isReservation: true, status: 'active' },
      });
      const activeReservationsGen = reservationsGen.filter(
        (r) => !r.reservationExpiry || new Date(r.reservationExpiry) > nowGen
      );
      const reservationIdsGen = activeReservationsGen.map((r) => r.id);
      const reservationItemsGen = reservationIdsGen.length > 0
        ? await ds.getRepository(SaleItemEntity).find({ where: { saleId: In(reservationIdsGen) } })
        : [];
      const reservedQtyByFlavorIdGen = new Map<string, number>();
      for (const item of reservationItemsGen) {
        reservedQtyByFlavorIdGen.set(item.flavorId, (reservedQtyByFlavorIdGen.get(item.flavorId) ?? 0) + item.quantity);
      }

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
                const quantity = stock?.quantity ?? 0;
                const reservedQty = reservedQtyByFlavorIdGen.get(f.id) ?? 0;
                const availableQty = Math.max(0, quantity - reservedQty);
                return {
                  id: f.id,
                  name: f.name,
                  stock: availableQty,
                } as FlavorData;
              })
              .filter((f) => (f.stock ?? 0) > 0);

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
        ctx.chat && await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {}

      if (!postText || postText.trim().length === 0) {
        await ctx.reply('❌ Не удалось сгенерировать пост. Возможно, у выбранных форматов нет товаров в наличии.');
        return;
      }

      // Отправляем пост напрямую как обычное сообщение
      await ctx.reply(postText);
    } catch (error) {
      console.error('Error generating post:', error);
      try {
        ctx.chat && await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {}
      await ctx.reply('❌ Ошибка при генерации поста.');
    }
  }
});

// Обработка callback для настроек формата
bot.action(/^config_(.+)$/, async (ctx) => {
  const state = formatCreationState.get(ctx.from.id);
  if (!state || state.step !== 'config') {
    await ctx.answerCbQuery('Сессия истекла. Начните заново с /createformat');
    return;
  }

  const action = ctx.match[1];

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

    try {
      // Check if editing existing format
      if (state.name && state.template) {
        const existingFormat = await formatRepo.findOne({
          where: { name: state.name, shopId: userShop.shopId },
        });

        if (existingFormat) {
          // Update existing format
          existingFormat.template = state.template;
          existingFormat.config = state.config as any;
          await formatRepo.save(existingFormat);
          await ctx.editMessageText(
            `✅ Формат "${state.name}" обновлен!\n\nИспользуйте /listformats для просмотра всех форматов.`
          );
        } else {
          // Create new format
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

/**
 * Проверяет, что POST запрос пришёл от Telegram (через secret_token).
 * Telegram отправляет X-Telegram-Bot-Api-Secret-Token при установленном secret_token.
 */
function isAuthorizedWebhookPost(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const header = request.headers.get('x-telegram-bot-api-secret-token');
  return header === secret;
}

/**
 * Проверяет авторизацию для GET операций (setWebhook, deleteWebhook, getInfo).
 */
function isAuthorizedWebhookAdmin(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get('secret') === secret;
}

// Обработка webhook
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedWebhookPost(request)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Webhook] Received update:', {
        update_id: body.update_id,
        type: body.message ? 'message' : body.callback_query ? 'callback_query' : 'other',
      });
    } else {
      console.log('[Webhook] Received update:', { update_id: body.update_id });
    }

    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Webhook] Telegram webhook error:', error);
    console.error('[Webhook] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}

// Для настройки webhook (GET запрос)
export async function GET(request: NextRequest) {
  if (!isAuthorizedWebhookAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const setWebhook = url.searchParams.get('setWebhook');
  const deleteWebhook = url.searchParams.get('deleteWebhook');
  const getInfo = url.searchParams.get('info');

  // Получить информацию о текущем webhook
  if (getInfo === 'true') {
    try {
      const webhookInfo = await bot.telegram.getWebhookInfo();
      return NextResponse.json({ 
        ok: true, 
        webhookInfo: {
          url: webhookInfo.url,
          has_custom_certificate: webhookInfo.has_custom_certificate,
          pending_update_count: webhookInfo.pending_update_count,
          last_error_date: webhookInfo.last_error_date,
          last_error_message: webhookInfo.last_error_message,
          max_connections: webhookInfo.max_connections,
          allowed_updates: webhookInfo.allowed_updates
        }
      });
    } catch (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
  }

  // Удалить webhook
  if (deleteWebhook === 'true') {
    try {
      await bot.telegram.deleteWebhook();
      return NextResponse.json({ ok: true, message: 'Webhook deleted successfully' });
    } catch (error) {
      return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
  }

  // Установить webhook
  if (setWebhook === 'true') {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || url.origin + '/api/telegram/webhook';
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    try {
      console.log('[Webhook] Setting webhook to:', webhookUrl);
      await bot.telegram.setWebhook(webhookUrl, {
        ...(webhookSecret && { secret_token: webhookSecret }),
      });
      const webhookInfo = await bot.telegram.getWebhookInfo();
      return NextResponse.json({ 
        ok: true, 
        message: `Webhook set to ${webhookUrl}`,
        webhookInfo: {
          url: webhookInfo.url,
          pending_update_count: webhookInfo.pending_update_count
        }
      });
    } catch (error) {
      console.error('[Webhook] Error setting webhook:', error);
      return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
    }
  }

  return NextResponse.json({ 
    ok: true, 
    message: 'Telegram webhook endpoint',
    usage: {
      setWebhook: 'GET /api/telegram/webhook?setWebhook=true',
      deleteWebhook: 'GET /api/telegram/webhook?deleteWebhook=true',
      getInfo: 'GET /api/telegram/webhook?info=true'
    }
  });
}
