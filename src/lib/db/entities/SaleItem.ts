import { EntitySchema } from 'typeorm';

export interface SaleItem {
  id: string;
  saleId: string;
  flavorId: string;
  productNameSnapshot: string;
  flavorNameSnapshot: string;
  unitPrice: number;
  costPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
  createdAt: Date;
}

export const SaleItemEntity = new EntitySchema<SaleItem>({
  name: 'SaleItem',
  tableName: 'sale_items',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    saleId: { type: 'uuid' },
    flavorId: { type: 'uuid' },
    productNameSnapshot: { type: String },
    flavorNameSnapshot: { type: String },
    unitPrice: { type: Number },
    costPriceSnapshot: { type: Number, default: 0 },
    quantity: { type: Number },
    lineTotal: { type: Number },
    createdAt: { type: Date, createDate: true },
  },
});
