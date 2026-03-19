import { EntitySchema } from 'typeorm';

export interface UserStats {
  id: string;
  userId: string;
  // Дни использования
  firstUsedAt: Date;
  lastUsedAt: Date;
  daysUsed: number; // Количество уникальных дней использования
  // Частота запусков
  totalSessions: number; // Общее количество сессий
  lastSessionAt: Date | null;
  // Использование функций
  inventoryViews: number;
  salesCreated: number;
  postsGenerated: number;
  debtsManaged: number;
  reportsViewed: number;
  // Метаданные
  createdAt: Date;
  updatedAt: Date;
}

export const UserStatsEntity = new EntitySchema<UserStats>({
  name: 'UserStats',
  tableName: 'user_stats',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    userId: { type: 'uuid' },
    firstUsedAt: { type: Date },
    lastUsedAt: { type: Date },
    daysUsed: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    lastSessionAt: { type: Date, nullable: true },
    inventoryViews: { type: Number, default: 0 },
    salesCreated: { type: Number, default: 0 },
    postsGenerated: { type: Number, default: 0 },
    debtsManaged: { type: Number, default: 0 },
    reportsViewed: { type: Number, default: 0 },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
  // Note: Relation is not defined here because TypeORM has a bug where it creates
  // 'character varying' instead of 'uuid' when relations are present in EntitySchema.
  // The foreign key is automatically created/verified by ensureUserStatsForeignKey()
  // in data-source.ts after DataSource initialization.
});
