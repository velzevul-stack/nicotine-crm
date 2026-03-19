import { EntitySchema } from 'typeorm';

export interface Shop {
  id: string;
  name: string;
  timezone: string;
  ownerId: string;
  currency: string;
  address: string | null;
  supportTelegramUsername: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  defaultPostFormatId: string | null; // ID выбранного формата поста по умолчанию
  createdAt: Date;
  updatedAt: Date;
}

export const ShopEntity = new EntitySchema<Shop>({
  name: 'Shop',
  tableName: 'shops',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    name: { type: String },
    timezone: { type: String, default: 'Europe/Minsk' },
    ownerId: { type: 'uuid' },
    currency: { type: String, default: 'BYN' },
    address: { type: String, nullable: true },
    supportTelegramUsername: { type: String, nullable: true },
    country: { type: String, nullable: true },
    city: { type: String, nullable: true },
    region: { type: String, nullable: true },
    defaultPostFormatId: { type: String, nullable: true },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
