import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { BrandEntity, CategoryEntity, ProductFormatEntity } from '@/lib/db/entities';
import { z } from 'zod';
import { isSafePhotoUrl } from '@/lib/image-validate';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  emojiPrefix: z.string().optional(),
  photoUrl: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v === null || v === undefined || isSafePhotoUrl(v), {
      message: 'photoUrl must be /uploads/brands/<uuid>.(jpg|jpeg|png|webp)',
    }),
  categoryId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const brandId = params.id;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  
  return ds.transaction(async (em) => {
    const brandRepo = em.getRepository(BrandEntity);
    const brand = await brandRepo.findOne({
      where: { id: brandId, shopId: session.shopId },
    });

    if (!brand) {
      return NextResponse.json({ message: 'Brand not found' }, { status: 404 });
    }

    if (parsed.data.name !== undefined) brand.name = parsed.data.name;
    if (parsed.data.emojiPrefix !== undefined) brand.emojiPrefix = parsed.data.emojiPrefix;
    if (parsed.data.photoUrl !== undefined) brand.photoUrl = parsed.data.photoUrl;
    if (parsed.data.sortOrder !== undefined) brand.sortOrder = parsed.data.sortOrder;
    
    if (parsed.data.categoryId !== undefined) {
      // Verify category exists and belongs to shop
      const categoryRepo = em.getRepository(CategoryEntity);
      const category = await categoryRepo.findOne({
        where: { id: parsed.data.categoryId, shopId: session.shopId },
      });
      
      if (!category) {
        return NextResponse.json({ message: 'Category not found' }, { status: 404 });
      }
      
      brand.categoryId = parsed.data.categoryId;
    }

    await brandRepo.save(brand);

    return NextResponse.json({ success: true, brand });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const brandId = params.id;

  const ds = await getDataSource();
  
  return ds.transaction(async (em) => {
    const brandRepo = em.getRepository(BrandEntity);
    const formatRepo = em.getRepository(ProductFormatEntity);

    const brand = await brandRepo.findOne({
      where: { id: brandId, shopId: session.shopId },
    });

    if (!brand) {
      return NextResponse.json({ message: 'Brand not found' }, { status: 404 });
    }

    // Проверяем, есть ли связанные форматы продуктов
    const formatsCount = await formatRepo.count({
      where: { brandId: brandId, shopId: session.shopId },
    });

    if (formatsCount > 0) {
      return NextResponse.json(
        { 
          message: `Невозможно удалить бренд: в нём есть ${formatsCount} формат(ов) продукта. Сначала удалите или переместите все форматы из этого бренда.` 
        },
        { status: 400 }
      );
    }

    await brandRepo.remove(brand);

    return NextResponse.json({ success: true });
  });
}
