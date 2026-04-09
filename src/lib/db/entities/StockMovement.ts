import { EntitySchema } from 'typeorm';

export type StockZone = 'post' | 'warehouse';
export type StockMovementActionType =
  | 'receipt_to_post'
  | 'receipt_to_warehouse'
  | 'sale'
  | 'reservation_sale'
  | 'debt_sale'
  | 'cancel_sale'
  | 'manual_transfer'
  | 'manual_decrease'
  | 'clear_stock';

export type StockMovementContextType = 'sale' | 'debt' | 'reservation' | null;

export interface StockMovement {
  id: string;
  shopId: string;
  productId: string;
  productName: string;
  actionType: StockMovementActionType;
  fromZone: StockZone | null;
  toZone: StockZone | null;
  quantity: number;
  postStockBefore: number;
  postStockAfter: number;
  warehouseBefore: number;
  warehouseAfter: number;
  contextType: StockMovementContextType;
  contextId: string | null;
  comment: string | null;
  createdAt: Date;
}

export const StockMovementEntity = new EntitySchema<StockMovement>({
  name: 'StockMovement',
  tableName: 'stock_movements',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    productId: { type: 'uuid' },
    productName: { type: String },
    actionType: { type: String },
    fromZone: { type: String, nullable: true },
    toZone: { type: String, nullable: true },
    quantity: { type: Number },
    postStockBefore: { type: Number, default: 0 },
    postStockAfter: { type: Number, default: 0 },
    warehouseBefore: { type: Number, default: 0 },
    warehouseAfter: { type: Number, default: 0 },
    contextType: { type: String, nullable: true },
    contextId: { type: String, nullable: true },
    comment: { type: String, nullable: true },
    createdAt: { type: Date, createDate: true },
  },
  indices: [
    { name: 'idx_stock_movements_shop_created_at', columns: ['shopId', 'createdAt'] },
    { name: 'idx_stock_movements_shop_product', columns: ['shopId', 'productId'] },
  ],
});
