import { EntitySchema } from 'typeorm';

export interface Debt {
  id: string;
  shopId: string;
  customerName: string;
  totalDebt: number;
  updatedAt: Date;
  createdAt: Date;
}

export const DebtEntity = new EntitySchema<Debt>({
  name: 'Debt',
  tableName: 'debts',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid' },
    customerName: { type: String },
    totalDebt: { type: Number, default: 0 },
    updatedAt: { type: Date, updateDate: true },
    createdAt: { type: Date, createDate: true },
  },
});
