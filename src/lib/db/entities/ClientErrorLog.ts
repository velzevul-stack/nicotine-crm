import { EntitySchema } from 'typeorm';

export interface ClientErrorLog {
  id: string;
  createdAt: Date;
  shopId: string | null;
  userId: string | null;
  kind: string;
  message: string;
  stack: string | null;
  href: string | null;
  userAgent: string | null;
}

export const ClientErrorLogEntity = new EntitySchema<ClientErrorLog>({
  name: 'ClientErrorLog',
  tableName: 'client_error_logs',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    createdAt: { type: Date, createDate: true },
    shopId: { type: 'uuid', nullable: true },
    userId: { type: 'uuid', nullable: true },
    kind: { type: String, default: 'runtime' },
    message: { type: String, length: 500 },
    stack: { type: 'text', nullable: true },
    href: { type: String, length: 2000, nullable: true },
    userAgent: { type: String, length: 512, nullable: true },
  },
  indices: [{ columns: ['createdAt'] }],
});
