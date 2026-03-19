import { EntitySchema } from 'typeorm';

export interface DebtOperation {
  id: string;
  debtId: string;
  saleId: string | null;
  amount: number;
  datetime: Date;
  comment: string | null;
  createdAt: Date;
}

export const DebtOperationEntity = new EntitySchema<DebtOperation>({
  name: 'DebtOperation',
  tableName: 'debt_operations',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    debtId: { type: 'uuid' },
    saleId: { type: 'uuid', nullable: true },
    amount: { type: Number },
    datetime: { type: Date },
    comment: { type: String, nullable: true },
    createdAt: { type: Date, createDate: true },
  },
});
