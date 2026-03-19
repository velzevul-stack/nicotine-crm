import { EntitySchema } from 'typeorm';

export interface User {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  role: 'admin' | 'seller' | 'client';
  accessKey: string | null;
  subscriptionStatus: 'trial' | 'active' | 'expired';
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  referralCode: string | null;
  referrerId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const UserEntity = new EntitySchema<User>({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    telegramId: { type: String, unique: true },
    firstName: { type: String, nullable: true },
    lastName: { type: String, nullable: true },
    username: { type: String, nullable: true },
    role: { type: String, default: 'seller' },
    accessKey: { type: String, nullable: true, unique: true },
    subscriptionStatus: { type: String, default: 'trial' },
    trialEndsAt: { type: Date, nullable: true },
    subscriptionEndsAt: { type: Date, nullable: true },
    referralCode: { type: String, nullable: true, unique: true },
    referrerId: { type: String, nullable: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
