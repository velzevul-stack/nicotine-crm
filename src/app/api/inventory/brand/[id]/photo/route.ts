import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { getSession } from '@/lib/auth';
import { BrandEntity } from '@/lib/db/entities';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import {
  getImageExtensionFromBuffer,
  MAX_IMAGE_SIZE_BYTES,
} from '@/lib/image-validate';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'brands');
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: brandId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  if (!UUID_REGEX.test(brandId)) {
    return NextResponse.json({ message: 'Invalid brand ID' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('photo') as File | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ message: 'No photo file provided' }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      { message: `File too large. Max size: ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB` },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = getImageExtensionFromBuffer(buffer);
  if (!ext) {
    return NextResponse.json(
      { message: 'Invalid file content. Use JPEG, PNG or WebP image' },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const brandRepo = ds.getRepository(BrandEntity);
  const brand = await brandRepo.findOne({
    where: { id: brandId, shopId: session.shopId },
  });

  if (!brand) {
    return NextResponse.json({ message: 'Brand not found' }, { status: 404 });
  }

  const filename = `${brandId}${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.resolve(path.join(UPLOAD_DIR, filename));
  const uploadDirResolved = path.resolve(UPLOAD_DIR);
  if (!filePath.startsWith(uploadDirResolved + path.sep) && filePath !== uploadDirResolved) {
    return NextResponse.json({ message: 'Invalid file path' }, { status: 400 });
  }
  await writeFile(filePath, buffer);

  const photoUrl = `/uploads/brands/${filename}`;
  brand.photoUrl = photoUrl;
  await brandRepo.save(brand);

  return NextResponse.json({ success: true, photoUrl });
}
