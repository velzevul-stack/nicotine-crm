import { EntitySchema } from 'typeorm';

export interface UserShop {
  id: string;
  userId: string;
  shopId: string;
  roleInShop: string;
  createdAt: Date;
  updatedAt: Date;
}

export const UserShopEntity = new EntitySchema<UserShop>({
  name: 'UserShop',
  tableName: 'user_shops',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    userId: { type: 'uuid' },
    shopId: { type: 'uuid' },
    roleInShop: { type: String, default: 'seller' },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
