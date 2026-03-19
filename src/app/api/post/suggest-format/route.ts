import { NextRequest, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/db/data-source';
import { PostFormatSuggestionEntity } from '@/lib/db/entities';
import { getSession } from '@/lib/auth';
import { z } from 'zod';

const suggestSchema = z.object({
  text: z.string().min(10, 'Предложение должно содержать минимум 10 символов'),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = suggestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid body', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ds = await getDataSource();
  const suggestionRepo = ds.getRepository(PostFormatSuggestionEntity);

  const suggestion = suggestionRepo.create({
    userId: session.userId,
    text: parsed.data.text,
    status: 'pending',
  });

  await suggestionRepo.save(suggestion);

  return NextResponse.json({ success: true, suggestion });
}
