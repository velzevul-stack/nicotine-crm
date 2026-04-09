import { EntitySchema } from 'typeorm';

export interface StockItem {
  id: string;
  shopId: string;
  flavorId: string;
  quantity: number;
  postQuantity: number;
  reservedQuantity: number;
  costPrice: number;
  packCost: number | null;
  piecesPerPack: number | null;
  costPerPiece: number | null;
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
    postQuantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
    packCost: { type: Number, nullable: true },
    piecesPerPack: { type: Number, nullable: true },
    costPerPiece: { type: Number, nullable: true },
    minThreshold: { type: Number, nullable: true },
    updatedAt: { type: Date, updateDate: true },
    createdAt: { type: Date, createDate: true },
  },
  uniques: [
    {
      name: 'uq_stock_items_shop_flavor',
      columns: ['shopId', 'flavorId'],
    },
  ],
});
