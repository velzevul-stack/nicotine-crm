import { EntitySchema } from 'typeorm';

export interface ReferralEarning {
  id: string;
  referrerId: string;
  referralId: string;
  amount: number;
  currency: string;
  source: 'stars' | 'crypto';
  paymentId: string | null;
  createdAt: Date;
}

export const ReferralEarningEntity = new EntitySchema<ReferralEarning>({
  name: 'ReferralEarning',
  tableName: 'referral_earnings',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    referrerId: { type: String },
    referralId: { type: String },
    amount: { type: 'decimal', precision: 10, scale: 2 },
    currency: { type: String, default: 'usd' },
    source: { type: String },
    paymentId: { type: String, nullable: true },
    createdAt: { type: Date, createDate: true },
  },
});
