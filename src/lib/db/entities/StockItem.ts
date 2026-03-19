import { EntitySchema } from 'typeorm';

export interface StockItem {
  id: string;
  shopId: string;
  flavorId: string;
  quantity: number;
  reservedQuantity: number;
  costPrice: number;
  minThreshold: number | null;
  updatedAt: Date;
  createdAt: Date;
}

export const StockItemEntity = new EntitySchema<StockItem>({
  name: 'StockItem',
  tableName: 'stock_items',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    flavorId: { type: 'uuid' },
    quantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
    minThreshold: { type: Number, nullable: true },
    updatedAt: { type: Date, updateDate: true },
    createdAt: { type: Date, createDate: true },
  },
});
