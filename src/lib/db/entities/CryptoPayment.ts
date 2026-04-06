import { EntitySchema } from 'typeorm';

export interface CryptoPayment {
  id: string;
  userId: string;
  invoiceId: string;
  orderId: string;
  priceAmount: number;
  priceCurrency: string;
  payAmount: number | null;
  payCurrency: string | null;
  invoiceUrl: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'sending' | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired';
  nowpaymentsPaymentId: string | null;
  subscriptionMonths: number;
  createdAt: Date;
  updatedAt: Date;
}

export const CryptoPaymentEntity = new EntitySchema<CryptoPayment>({
  name: 'CryptoPayment',
  tableName: 'crypto_payments',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    userId: { type: String },
    invoiceId: { type: String, unique: true },
    orderId: { type: String, unique: true },
    priceAmount: { type: 'decimal', precision: 10, scale: 2 },
    priceCurrency: { type: String, default: 'usd' },
    payAmount: { type: 'decimal', precision: 18, scale: 8, nullable: true },
    payCurrency: { type: String, nullable: true },
    invoiceUrl: { type: String },
    status: { type: String, default: 'pending' },
    nowpaymentsPaymentId: { type: String, nullable: true },
    subscriptionMonths: { type: Number, default: 1 },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
