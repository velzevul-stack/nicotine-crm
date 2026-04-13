import { getDataSource } from '@/lib/db/data-source';
import { PostFormatEntity, type PostFormat } from '@/lib/db/entities';
import { requireAdminUser } from '@/services/admin/admin-guard';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  template: z.string().min(1),
  isActive: z.boolean().default(true),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  template: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function adminListGlobalPostFormats(adminUserId: string): Promise<PostFormat[]> {
  await requireAdminUser(adminUserId);
  const ds = await getDataSource();
  return ds.getRepository(PostFormatEntity).find({
    order: { createdAt: 'DESC' },
  });
}

export async function adminCreateGlobalPostFormat(
  adminUserId: string,
  body: unknown,
): Promise<PostFormat> {
  await requireAdminUser(adminUserId);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);
  const format = formatRepo.create({
    name: parsed.data.name,
    template: parsed.data.template,
    isActive: parsed.data.isActive,
  });
  return formatRepo.save(format);
}

export async function adminUpdateGlobalPostFormat(
  adminUserId: string,
  body: unknown,
): Promise<PostFormat> {
  await requireAdminUser(adminUserId);

  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const id = b.id as string | undefined;
  const updates = { ...b };
  delete updates.id;

  if (!id) {
    throw new ValidationError('Format ID required');
  }

  const parsed = updateSchema.safeParse(updates);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);
  const format = await formatRepo.findOne({ where: { id } });
  if (!format) {
    throw new NotFoundError('Format not found');
  }

  if (parsed.data.name !== undefined) format.name = parsed.data.name;
  if (parsed.data.template !== undefined) format.template = parsed.data.template;
  if (parsed.data.isActive !== undefined) format.isActive = parsed.data.isActive;

  return formatRepo.save(format);
}

export async function adminDeleteGlobalPostFormat(
  adminUserId: string,
  formatId: string,
): Promise<void> {
  await requireAdminUser(adminUserId);
  if (!formatId) {
    throw new ValidationError('Format ID required');
  }
  const ds = await getDataSource();
  await ds.getRepository(PostFormatEntity).delete({ id: formatId });
}
