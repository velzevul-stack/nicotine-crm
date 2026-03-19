import { EntitySchema } from 'typeorm';

export interface Flavor {
  id: string;
  shopId: string;
  productFormatId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  customValues?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const FlavorEntity = new EntitySchema<Flavor>({
  name: 'Flavor',
  tableName: 'flavors',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    productFormatId: { type: 'uuid' },
    name: { type: String },
    sku: { type: String, nullable: true },
    barcode: { type: String, nullable: true },
    customValues: { type: 'jsonb', nullable: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
