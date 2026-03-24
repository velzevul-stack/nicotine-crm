import { EntitySchema } from 'typeorm';

export type PaymentType = 'cash' | 'card' | 'split' | 'debt'; // debt kept for backward compat
export type SaleStatus = 'active' | 'edited' | 'deleted';

export interface Sale {
  id: string;
  shopId: string;
  sellerId: string;
  datetime: Date;
  saleDate: Date;
  paymentType: PaymentType;
  totalAmount: number;
  totalCost: number | null;
  discountValue: number;
  discountType: 'absolute' | 'percent';
  deliveryAmount: number;
  finalAmount: number;
  cashAmount: number | null;
  cardAmount: number | null;
  cardId: string | null;
  comment: string | null;
  customerName: string | null;
  isReservation: boolean;
  reservationExpiry: Date | null;
  reservationCustomerName: string | null;
  status: SaleStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const SaleEntity = new EntitySchema<Sale>({
  name: 'Sale',
  tableName: 'sales',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    sellerId: { type: 'uuid' },
    datetime: { type: Date },
    saleDate: { type: Date },
    paymentType: { type: String },
    totalAmount: { type: Number },
    totalCost: { type: Number, nullable: true },
    discountValue: { type: Number, default: 0 },
    discountType: { type: String, default: 'absolute' },
    deliveryAmount: { type: Number, default: 0 },
    finalAmount: { type: Number },
    cashAmount: { type: Number, nullable: true },
    cardAmount: { type: Number, nullable: true },
    cardId: { type: String, nullable: true },
    comment: { type: String, nullable: true },
    customerName: { type: String, nullable: true },
    isReservation: { type: Boolean, default: false },
    reservationExpiry: { type: Date, nullable: true },
    reservationCustomerName: { type: String, nullable: true },
    status: { type: String, default: 'active' },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
