import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostQuantityToStockItems1760200000000 implements MigrationInterface {
  name = 'AddPostQuantityToStockItems1760200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "postQuantity" integer NOT NULL DEFAULT 0`
    );
    await queryRunner.query(
      `UPDATE "stock_items" SET "postQuantity" = "quantity" WHERE "postQuantity" IS NULL`
    );
    await queryRunner.query(
      `UPDATE "stock_items" SET "postQuantity" = "quantity" WHERE "postQuantity" <> "quantity"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stock_items" DROP COLUMN IF EXISTS "postQuantity"`);
  }
}
