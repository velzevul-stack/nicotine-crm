import { getDataSource } from '@/lib/db/data-source';
import type { Session } from '@/lib/session-token';
import { PostFormatEntity, type PostFormat } from '@/lib/db/entities';
import { checkUserSubscription } from '@/lib/auth-utils';
import { IsNull, type FindOptionsWhere } from 'typeorm';
import { ForbiddenError, NotFoundError, ValidationError } from '@/services/common/domain-errors';

export async function listPostFormats(shopId: string): Promise<PostFormat[]> {
  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const whereConditions: FindOptionsWhere<PostFormat>[] = [{ isActive: true, shopId: IsNull() }];
  if (shopId) {
    whereConditions.push({ isActive: true, shopId });
  }

  return formatRepo.find({
    where: whereConditions,
    order: { createdAt: 'DESC' },
  });
}

export async function createPostFormat(session: Session, body: unknown): Promise<PostFormat> {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const name = b.name;
  const template = b.template;
  const config = b.config;
  const shopIdBody = b.shopId as string | undefined;

  if (!name || !template || typeof name !== 'string' || typeof template !== 'string') {
    throw new ValidationError('Name and template are required');
  }

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const format = formatRepo.create({
    name,
    template,
    config: config ?? null,
    shopId: shopIdBody || session.shopId,
    createdBy: session.userId,
    isActive: true,
  });

  return formatRepo.save(format);
}

export async function importPostFormat(session: Session, body: unknown): Promise<PostFormat> {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const formatId = b.formatId as string | undefined;
  const name = b.name;
  const template = b.template;
  const config = b.config;

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  if (formatId) {
    const sourceFormat = await formatRepo.findOne({
      where: { id: formatId },
    });

    if (!sourceFormat) {
      throw new NotFoundError('Source format not found');
    }

    const newFormat = formatRepo.create({
      name: (typeof name === 'string' && name) || `${sourceFormat.name} (Copy)`,
      template: sourceFormat.template,
      config: sourceFormat.config,
      shopId: session.shopId,
      createdBy: session.userId,
      isActive: true,
    });

    return formatRepo.save(newFormat);
  }

  if (!template || typeof template !== 'string' || !name || typeof name !== 'string') {
    throw new ValidationError('Name and template are required');
  }

  const newFormat = formatRepo.create({
    name,
    template,
    config: config ?? null,
    shopId: session.shopId,
    createdBy: session.userId,
    isActive: true,
  });

  return formatRepo.save(newFormat);
}

export async function getPostFormatById(session: Session, id: string): Promise<PostFormat> {
  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const format = await formatRepo.findOne({
    where: [{ id, shopId: IsNull() }, { id, shopId: session.shopId }],
  });

  if (!format) {
    throw new NotFoundError('Format not found');
  }

  return format;
}

export async function updatePostFormat(
  session: Session,
  id: string,
  body: unknown,
): Promise<PostFormat> {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const name = b.name;
  const template = b.template;
  const config = b.config;
  const isActive = b.isActive;

  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const format = await formatRepo.findOne({
    where: [{ id, shopId: IsNull() }, { id, shopId: session.shopId }],
  });

  if (!format) {
    throw new NotFoundError('Format not found');
  }

  const userWithSub = await checkUserSubscription(session.userId);
  const isAdmin = userWithSub?.role === 'admin';

  if (format.shopId === null && !isAdmin) {
    throw new ForbiddenError('Cannot edit global formats');
  }

  if (format.shopId !== null && format.shopId !== session.shopId) {
    throw new ForbiddenError('Cannot edit other shop formats');
  }

  if (name !== undefined) format.name = name as string;
  if (template !== undefined) format.template = template as string;
  if (config !== undefined) format.config = config as PostFormat['config'];
  if (isActive !== undefined) format.isActive = Boolean(isActive);

  return formatRepo.save(format);
}

export async function deletePostFormat(session: Session, id: string): Promise<void> {
  const ds = await getDataSource();
  const formatRepo = ds.getRepository(PostFormatEntity);

  const format = await formatRepo.findOne({
    where: [{ id, shopId: IsNull() }, { id, shopId: session.shopId }],
  });

  if (!format) {
    throw new NotFoundError('Format not found');
  }

  const userWithSub = await checkUserSubscription(session.userId);
  const isAdmin = userWithSub?.role === 'admin';

  if (format.shopId === null && !isAdmin) {
    throw new ForbiddenError('Cannot delete global formats');
  }

  if (format.shopId !== null && format.shopId !== session.shopId) {
    throw new ForbiddenError('Cannot delete other shop formats');
  }

  await formatRepo.remove(format);
}
