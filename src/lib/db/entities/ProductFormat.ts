import { EntitySchema } from 'typeorm';

export interface ProductFormat {
  id: string;
  shopId: string;
  brandId: string;
  name: string;
  strengthLabel: string;
  unitPrice: number;
  isLiquid: boolean;
  customValues?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ProductFormatEntity = new EntitySchema<ProductFormat>({
  name: 'ProductFormat',
  tableName: 'product_formats',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    brandId: { type: 'uuid' },
    name: { type: String },
    strengthLabel: { type: String, default: '' },
    unitPrice: { type: Number },
    isLiquid: { type: Boolean, default: true },
    customValues: { type: 'jsonb', nullable: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
