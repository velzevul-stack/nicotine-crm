/**
 * Сцена генерации поста - обработка всех callback для генерации постов
 * Вынесено в отдельный модуль для улучшения читаемости
 */

import { Context } from 'telegraf';
import { DataSource } from 'typeorm';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
  ShopEntity,
  PostFormatEntity,
  SaleEntity,
  SaleItemEntity,
} from '@/lib/db/entities';
import { In, IsNull } from 'typeorm';
import { renderTemplate, PostData, CategoryData, BrandData, FormatData, FlavorData, ShopData, FormatConfig } from '@/lib/post/template-renderer';

export interface PostGenerationState {
  selectedFormatIds: Set<string>;
  selectedPostFormatId: string | null;
  filters: {
    selectedCategories: string[];
    selectedBrands: string[];
    selectedStrengths: string[];
    selectedColors: string[];
  };
  page: number;
}

/**
 * Обработка всех callback для генерации постов
 * Эта функция содержит всю логику из оригинального файла (строки 1473-2367)
 */
export async function handlePostCallbacks(
  ctx: Context,
  action: string,
  userId: number,
  userShopId: string,
  state: PostGenerationState,
  dataSource: DataSource,
  showPostMenu: (ctx: any, userId: number, userShopId: string) => Promise<{ message: string; keyboard: any[][] }>
) {
  const userShopRepo = dataSource.getRepository(UserShopEntity);
  const userShop = await userShopRepo.findOne({ where: { shopId: userShopId } });
  
  if (!userShop) {
    await ctx.answerCbQuery('❌ Вы не привязаны к магазину');
    return;
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
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'select_all') {
    const [formats, flavors, stocks] = await dataSource.transaction(async (em) => {
      const formatRepo = em.getRepository(ProductFormatEntity);
      const flavorRepo = em.getRepository(FlavorEntity);
      const stockRepo = em.getRepository(StockItemEntity);
      return Promise.all([
        formatRepo.find({ where: { shopId: userShopId, isActive: true } }),
        flavorRepo.find({ where: { shopId: userShopId, isActive: true } }),
        stockRepo.find({ where: { shopId: userShopId } }),
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
    await ctx.answerCbQuery('Все форматы выбраны');
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'deselect_all') {
    state.selectedFormatIds.clear();
    await ctx.answerCbQuery('Все форматы сняты');
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'select_format') {
    const postFormatRepo = dataSource.getRepository(PostFormatEntity);
    const postFormats = await postFormatRepo.find({
      where: [
        { isActive: true, shopId: IsNull() },
        { isActive: true, shopId: userShopId },
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
    await ctx.answerCbQuery('Формат поста выбран');
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'back') {
    const { message, keyboard } = await showPostMenu(ctx, userId, userShopId);
    await ctx.editMessageText(message, {
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
    await ctx.answerCbQuery('Фильтры сброшены');
    
    const { message, keyboard } = await showPostMenu(ctx, userId, userShopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'page_prev') {
    if (state.page > 0) {
      state.page--;
    }
    const { message, keyboard } = await showPostMenu(ctx, userId, userShopId);
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } else if (action === 'page_next') {
    state.page++;
    const { message, keyboard } = await showPostMenu(ctx, userId, userShopId);
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
      const [categories, brands, formats, flavors, stocks, shop, postFormats] = await dataSource.transaction(async (em) => {
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

      const now = new Date();
      const reservations = await dataSource.getRepository(SaleEntity).find({
        where: { shopId: userShopId, isReservation: true, status: 'active' },
      });
      const activeReservations = reservations.filter(
        (r) => !r.reservationExpiry || new Date(r.reservationExpiry) > now
      );
      const reservationIds = activeReservations.map((r) => r.id);
      const reservationItems = reservationIds.length > 0
        ? await dataSource.getRepository(SaleItemEntity).find({ where: { saleId: In(reservationIds) } })
        : [];
      const reservedQtyByFlavorId = new Map<string, number>();
      for (const item of reservationItems) {
        reservedQtyByFlavorId.set(item.flavorId, (reservedQtyByFlavorId.get(item.flavorId) ?? 0) + item.quantity);
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
                const reservedQty = reservedQtyByFlavorId.get(f.id) ?? 0;
                const availableQty = Math.max(0, quantity - reservedQty);
                return {
                  id: f.id,
                  name: f.name,
                  stock: availableQty,
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
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {}

      if (!postText || postText.trim().length === 0) {
        await ctx.reply('❌ Не удалось сгенерировать пост. Возможно, у выбранных форматов нет товаров в наличии.');
        return;
      }

      const prefix = action === 'preview' ? '👁️ Предпросмотр поста:' : '📝 Ваш пост для копирования:';
      await ctx.reply(`${prefix}\n\n\`\`\`\n${postText}\n\`\`\``, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error(`Error generating ${action === 'preview' ? 'preview' : 'post'}:`, error);
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      } catch (e) {}
      await ctx.reply(`❌ Ошибка при генерации ${action === 'preview' ? 'предпросмотра' : 'поста'}.`);
    }
  }
  // Обработка фильтров (filters, toggle_category, toggle_brand, toggle_strength) 
  // оставлена в главном файле из-за большого объема кода
}
