import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import {
  CategoryEntity,
  BrandEntity,
  ProductFormatEntity,
  FlavorEntity,
  StockItemEntity,
} from '@/lib/db/entities';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const ds = await Promise.race([
    getDataSource(),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 10000)
    )
  ]);

  const search = (request.nextUrl.searchParams.get('search') ?? '').toLowerCase();
  const inStockOnly = request.nextUrl.searchParams.get('inStockOnly') === '1';
  const noBarcode = request.nextUrl.searchParams.get('noBarcode') === '1';
  const showReservedOnly = request.nextUrl.searchParams.get('showReservedOnly') === '1';
  const minPrice = request.nextUrl.searchParams.get('minPrice');
  const maxPrice = request.nextUrl.searchParams.get('maxPrice');
  const categoryId = request.nextUrl.searchParams.get('categoryId');
  const strength = request.nextUrl.searchParams.get('strength');
  const brandId = request.nextUrl.searchParams.get('brandId');
  const color = request.nextUrl.searchParams.get('color');

  // Используем транзакцию для предотвращения параллельных запросов на одном соединении
  // Fetch all data with sorting
  const [categories, brands, formats, flavors, stocks] = await ds.transaction(async (em) => {
    const categoryRepo = em.getRepository(CategoryEntity);
    const brandRepo = em.getRepository(BrandEntity);
    const formatRepo = em.getRepository(ProductFormatEntity);
    const flavorRepo = em.getRepository(FlavorEntity);
    const stockRepo = em.getRepository(StockItemEntity);

    return Promise.all([
      categoryRepo.find({
        where: { shopId: session.shopId },
        order: { sortOrder: 'ASC' },
      }),
      brandRepo.find({
        where: { shopId: session.shopId },
        order: { sortOrder: 'ASC', name: 'ASC' },
      }),
      formatRepo.find({
        where: { shopId: session.shopId, isActive: true },
        order: { name: 'ASC' },
      }),
      flavorRepo.find({
        where: { shopId: session.shopId, isActive: true },
        order: { name: 'ASC' },
      }),
      stockRepo.find({ where: { shopId: session.shopId } }),
    ]);
  });

  const stockMap = new Map(stocks.map((s) => [s.flavorId, s]));

  // Убеждаемся, что customFields всегда массив
  const categoriesWithDefaults = categories.map(cat => ({
    ...cat,
    customFields: cat.customFields || [],
  }));

  // Build the flat list with all details
  const items = categoriesWithDefaults.flatMap((cat) => {
    return brands
      .filter((b) => b.categoryId === cat.id)
      .flatMap((brand) => {
        return formats
          .filter((f) => f.brandId === brand.id)
          .flatMap((format) => {
            return flavors
              .filter((f) => f.productFormatId === format.id)
              .map((flavor) => {
                const stock = stockMap.get(flavor.id);
                const quantity = stock?.quantity ?? 0;
                const reservedQuantity = stock?.reservedQuantity ?? 0;
                const costPrice = stock?.costPrice ?? 0;
                
                return {
                  category: cat,
                  brand,
                  format,
                  flavor,
                  quantity,
                  reservedQuantity,
                  costPrice,
                  barcode: flavor.barcode,
                };
              });
          });
      });
  })
  .filter((i) => {
    if (categoryId && i.category.id !== categoryId) return false;
    if (brandId && i.brand.id !== brandId) return false;
    if (strength && i.format.strengthLabel !== strength) return false;
    if (color && i.flavor.name.trim().toLowerCase() !== color.trim().toLowerCase()) return false;
    if (showReservedOnly && i.reservedQuantity <= 0) return false;
    if (inStockOnly && i.quantity <= 0) return false;
    if (noBarcode && i.barcode) return false; // Show only items WITHOUT barcode if flag is set
    if (minPrice && i.format.unitPrice < parseFloat(minPrice)) return false;
    if (maxPrice && i.format.unitPrice > parseFloat(maxPrice)) return false;

    if (search) {
      const combined = `${i.brand.name} ${i.format.name} ${i.flavor.name} ${i.barcode ?? ''}`.toLowerCase();
      return combined.includes(search);
    }
    return true;
  });

  const enrichedFlavors = flavors.map((f) => {
    const stock = stockMap.get(f.id);
    return {
      ...f,
      quantity: stock?.quantity ?? 0,
      reservedQuantity: stock?.reservedQuantity ?? 0,
    };
  });

  return NextResponse.json({
    items, // Return the filtered flat list
    // Also return raw lists if frontend needs them for dropdowns etc
    categories: categoriesWithDefaults,
    brands,
    productFormats: formats,
    flavors: enrichedFlavors,
  });
}
