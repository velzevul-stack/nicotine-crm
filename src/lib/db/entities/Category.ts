import { EntitySchema } from 'typeorm';

export interface CategoryField {
  id: string;
  name: string; // Internal key (e.g., "flavor", "ohms")
  label: string; // Display label (e.g., "Вкус", "Омы")
  type: 'text' | 'number' | 'select';
  required: boolean;
  options?: string[]; // For 'select' type
  sortOrder: number;
  target?: 'flavor_name' | 'strength_label' | 'custom'; // Where to store this value
}

export interface Category {
  id: string;
  shopId: string;
  name: string;
  sortOrder: number;
  emoji: string;
  customFields: CategoryField[];
  createdAt: Date;
  updatedAt: Date;
}

export const CategoryEntity = new EntitySchema<Category>({
  name: 'Category',
  tableName: 'categories',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    name: { type: String },
    sortOrder: { type: Number, default: 0 },
    emoji: { type: String, default: '📦' },
    customFields: { 
      type: 'jsonb', 
      nullable: true,
    },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
