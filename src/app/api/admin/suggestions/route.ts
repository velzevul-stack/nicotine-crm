import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { PostFormatSuggestionEntity, UserEntity, PostFormatEntity } from '@/lib/db/entities';
import { getSession } from '@/lib/auth';
import { checkUserSubscription } from '@/lib/auth-utils';
import { In } from 'typeorm';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const ds = await getDataSource();
  const suggestionRepo = ds.getRepository(PostFormatSuggestionEntity);
  const userRepo = ds.getRepository(UserEntity);

  const suggestions = await suggestionRepo.find({
    order: { createdAt: 'DESC' },
  });

  // Enrich with user info - используем один запрос вместо Promise.all для избежания предупреждения
  const userIds = [...new Set(suggestions.map(s => s.userId))];
  const users = userIds.length > 0
    ? await userRepo.find({
        where: { id: In(userIds) },
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));
  
  const enriched = suggestions.map(s => {
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

  return NextResponse.json({ suggestions: enriched });
}

const updateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  createFormat: z.boolean().optional(),
  formatName: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userWithSub = await checkUserSubscription(session.userId);
  if (!userWithSub || userWithSub.role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ message: 'Suggestion ID required' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(updates);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const suggestionRepo = ds.getRepository(PostFormatSuggestionEntity);
  const formatRepo = ds.getRepository(PostFormatEntity);

  const suggestion = await suggestionRepo.findOne({ where: { id } });
  if (!suggestion) {
    return NextResponse.json({ message: 'Suggestion not found' }, { status: 404 });
  }

  suggestion.status = parsed.data.status;
  await suggestionRepo.save(suggestion);

  // Если нужно создать формат на основе предложения
  if (parsed.data.createFormat && parsed.data.formatName) {
    const format = formatRepo.create({
      name: parsed.data.formatName,
      template: suggestion.text, // Используем текст предложения как шаблон
      isActive: true,
    });
    await formatRepo.save(format);
  }

  return NextResponse.json({ success: true, suggestion });
}
