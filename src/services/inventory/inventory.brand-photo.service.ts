import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getDataSource } from '@/lib/db/data-source';
import { BrandEntity } from '@/lib/db/entities';
import { getImageExtensionFromBuffer, MAX_IMAGE_SIZE_BYTES } from '@/lib/image-validate';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import type { ShopContext } from '@/services/common/service-context';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'brands');
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function uploadBrandPhoto(context: ShopContext, brandId: string, formData: FormData) {
  if (!UUID_REGEX.test(brandId)) {
    throw new ValidationError('Invalid brand ID', undefined, { code: 'INVALID_BRAND_ID' });
  }

  const file = formData.get('photo');
  if (!file || !(file instanceof File)) {
    throw new ValidationError('No photo file provided', undefined, { code: 'NO_FILE' });
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new ValidationError(
      `File too large. Max size: ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB`,
      undefined,
      { code: 'FILE_TOO_LARGE' },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = getImageExtensionFromBuffer(buffer);
  if (!ext) {
    throw new ValidationError('Invalid file content. Use JPEG, PNG or WebP image', undefined, {
      code: 'INVALID_IMAGE',
    });
  }

  const ds = await getDataSource();
  const brandRepo = ds.getRepository(BrandEntity);
  const brand = await brandRepo.findOne({
    where: { id: brandId, shopId: context.shopId },
  });

  if (!brand) {
    throw new NotFoundError('Brand not found');
  }

  const filename = `${brandId}${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filePath = path.resolve(path.join(UPLOAD_DIR, filename));
  const uploadDirResolved = path.resolve(UPLOAD_DIR);
  if (!filePath.startsWith(uploadDirResolved + path.sep) && filePath !== uploadDirResolved) {
    throw new ValidationError('Invalid file path', undefined, { code: 'INVALID_PATH' });
  }

  await writeFile(filePath, buffer);

  const photoUrl = `/uploads/brands/${filename}`;
  brand.photoUrl = photoUrl;
  await brandRepo.save(brand);

  return { success: true as const, photoUrl };
}
