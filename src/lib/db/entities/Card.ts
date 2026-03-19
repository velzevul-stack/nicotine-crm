import { EntitySchema } from 'typeorm';

export interface Card {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export const CardEntity = new EntitySchema<Card>({
  name: 'Card',
  tableName: 'cards',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    name: { type: String },
    sortOrder: { type: Number, default: 0 },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
