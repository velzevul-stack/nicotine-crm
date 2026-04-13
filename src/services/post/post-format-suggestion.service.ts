import { getDataSource } from '@/lib/db/data-source';
import type { Session } from '@/lib/session-token';
import { PostFormatSuggestionEntity } from '@/lib/db/entities';
import type { PostFormatSuggestion } from '@/lib/db/entities/PostFormatSuggestion';
import { ValidationError } from '@/services/common/domain-errors';
import { postFormatSuggestionSchema } from '@/services/post/post-format-suggestion.validators';

export async function createPostFormatSuggestion(
  session: Session,
  body: unknown,
): Promise<{ suggestion: PostFormatSuggestion }> {
  const parsed = postFormatSuggestionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid body', parsed.error.flatten(), { code: 'INVALID_BODY' });
  }

  const ds = await getDataSource();
  const suggestionRepo = ds.getRepository(PostFormatSuggestionEntity);

  const suggestion = suggestionRepo.create({
    userId: session.userId,
    text: parsed.data.text,
    status: 'pending',
  });

  await suggestionRepo.save(suggestion);

  return { suggestion };
}
