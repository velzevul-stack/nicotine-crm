import { EntitySchema } from 'typeorm';

export interface PostFormatConfig {
  showFlavors?: boolean;
  showPrices?: boolean;
  showStock?: boolean;
  showCategories?: boolean;
  customSections?: Array<{
    id: string;
    label: string;
    template: string;
  }>;
}

export interface PostFormat {
  id: string;
  shopId: string | null; // null for global formats, shop ID for shop-specific formats
  name: string;
  template: string;
  config: PostFormatConfig | null;
  createdBy: string | null; // User ID who created the format
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const PostFormatEntity = new EntitySchema<PostFormat>({
  name: 'PostFormat',
  tableName: 'post_formats',
  columns: {
    id: { type: String, primary: true, generated: 'uuid' },
    shopId: { type: 'uuid', nullable: true },
    name: { type: String },
    template: { type: String },
    config: {
      type: 'jsonb',
      nullable: true,
    },
    createdBy: { type: 'uuid', nullable: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, createDate: true },
    updatedAt: { type: Date, updateDate: true },
  },
});
