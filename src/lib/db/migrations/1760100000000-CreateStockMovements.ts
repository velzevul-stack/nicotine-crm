import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockMovements1760100000000 implements MigrationInterface {
  name = 'CreateStockMovements1760100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "shopId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "productName" character varying NOT NULL,
        "actionType" character varying NOT NULL,
        "fromZone" character varying,
        "toZone" character varying,
        "quantity" integer NOT NULL DEFAULT 0,
        "postStockBefore" integer NOT NULL DEFAULT 0,
        "postStockAfter" integer NOT NULL DEFAULT 0,
        "warehouseBefore" integer NOT NULL DEFAULT 0,
        "warehouseAfter" integer NOT NULL DEFAULT 0,
        "contextType" character varying,
        "contextId" character varying,
        "comment" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_stock_movements_shop_created_at" ON "stock_movements" ("shopId", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_stock_movements_shop_product" ON "stock_movements" ("shopId", "productId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_stock_movements_shop_product"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_stock_movements_shop_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
  }
}
