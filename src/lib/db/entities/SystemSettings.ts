import { EntitySchema } from 'typeorm';

export interface SystemSettings {
  id: string;
  key: string; // Уникальный ключ настройки (например, 'maintenance_mode')
  value: string; // Значение в формате JSON
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const SystemSettingsEntity = new EntitySchema<SystemSettings>({
  name: 'SystemSettings',
  tableName: 'system_settings',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    key: { type: String, unique: true },
    value: { type: String },
    description: { type: String, nullable: true },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
