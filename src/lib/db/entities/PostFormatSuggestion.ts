import { EntitySchema } from 'typeorm';

export interface PostFormatSuggestion {
  id: string;
  userId: string;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export const PostFormatSuggestionEntity = new EntitySchema<PostFormatSuggestion>({
  name: 'PostFormatSuggestion',
  tableName: 'post_format_suggestions',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    userId: { type: 'uuid' },
    text: { type: String },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
