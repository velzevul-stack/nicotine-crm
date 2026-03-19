import { EntitySchema } from 'typeorm';

export interface Brand {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  emojiPrefix: string;
  photoUrl: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export const BrandEntity = new EntitySchema<Brand>({
  name: 'Brand',
  tableName: 'brands',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    categoryId: { type: 'uuid' },
    name: { type: String },
    emojiPrefix: { type: String, default: '' },
    photoUrl: { type: String, nullable: true },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
