import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { ProductFormatEntity, BrandEntity } from '@/lib/db/entities';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  strengthLabel: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
  isLiquid: z.boolean().optional(),
  isActive: z.boolean().optional(),
  brandId: z.string().uuid().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const formatId = params.id;
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
    const formatRepo = em.getRepository(ProductFormatEntity);
    const format = await formatRepo.findOne({
      where: { id: formatId, shopId: session.shopId },
    });

    if (!format) {
      return NextResponse.json({ message: 'Format not found' }, { status: 404 });
    }

    if (parsed.data.name !== undefined) format.name = parsed.data.name;
    if (parsed.data.strengthLabel !== undefined) {
      // Normalize "мг" to "mg"
      const normalized = parsed.data.strengthLabel.replace(/мг/gi, 'mg').trim();
      format.strengthLabel = normalized;
    }
    if (parsed.data.unitPrice !== undefined) format.unitPrice = parsed.data.unitPrice;
    if (parsed.data.isLiquid !== undefined) format.isLiquid = parsed.data.isLiquid;
    if (parsed.data.isActive !== undefined) format.isActive = parsed.data.isActive;
    
    if (parsed.data.brandId !== undefined) {
      // Verify brand exists and belongs to shop
      const brandRepo = em.getRepository(BrandEntity);
      const brand = await brandRepo.findOne({
        where: { id: parsed.data.brandId, shopId: session.shopId },
      });
      
      if (!brand) {
        return NextResponse.json({ message: 'Brand not found' }, { status: 404 });
      }
      
      format.brandId = parsed.data.brandId;
    }

    await formatRepo.save(format);

    return NextResponse.json({ success: true, format });
  });
}
