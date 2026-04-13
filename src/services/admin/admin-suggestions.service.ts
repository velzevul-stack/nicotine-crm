import { getDataSource } from '@/lib/db/data-source';
import { PostFormatEntity, PostFormatSuggestionEntity, UserEntity } from '@/lib/db/entities';
import { requireAdminUser } from '@/services/admin/admin-guard';
import { NotFoundError, ValidationError } from '@/services/common/domain-errors';
import { In } from 'typeorm';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  createFormat: z.boolean().optional(),
  formatName: z.string().optional(),
});

export async function adminListFormatSuggestions(adminUserId: string) {
  await requireAdminUser(adminUserId);

  const ds = await getDataSource();
  const suggestionRepo = ds.getRepository(PostFormatSuggestionEntity);
  const userRepo = ds.getRepository(UserEntity);

  const suggestions = await suggestionRepo.find({
    order: { createdAt: 'DESC' },
  });

  const userIds = [...new Set(suggestions.map((s) => s.userId))];
  const users =
    userIds.length > 0
      ? await userRepo.find({
          where: { id: In(userIds) },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const enriched = suggestions.map((s) => {
    const user = userMap.get(s.userId);
    return {
      ...s,
      user: user
        ? {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        : null,
    };
  });

  return { suggestions: enriched };
}

export async function adminUpdateFormatSuggestion(adminUserId: string, body: unknown) {
  await requireAdminUser(adminUserId);

  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const id = b.id as string | undefined;
  const updates = { ...b };
  delete updates.id;

  if (!id) {
    throw new ValidationError('Suggestion ID required');
  }

  const parsed = updateSchema.safeParse(updates);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const suggestionRepo = ds.getRepository(PostFormatSuggestionEntity);
  const formatRepo = ds.getRepository(PostFormatEntity);

  const suggestion = await suggestionRepo.findOne({ where: { id } });
  if (!suggestion) {
    throw new NotFoundError('Suggestion not found');
  }

  suggestion.status = parsed.data.status;
  await suggestionRepo.save(suggestion);

  if (parsed.data.createFormat && parsed.data.formatName) {
    const format = formatRepo.create({
      name: parsed.data.formatName,
      template: suggestion.text,
      isActive: true,
    });
    await formatRepo.save(format);
  }

  return { suggestion };
}
