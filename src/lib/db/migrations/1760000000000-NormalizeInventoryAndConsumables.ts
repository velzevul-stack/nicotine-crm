import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeInventoryAndConsumables1760000000000 implements MigrationInterface {
  name = 'NormalizeInventoryAndConsumables1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "flavors" ADD COLUMN IF NOT EXISTS "normalizedName" character varying`);
    await queryRunner.query(`ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "packCost" double precision`);
    await queryRunner.query(`ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "piecesPerPack" integer`);
    await queryRunner.query(`ALTER TABLE "stock_items" ADD COLUMN IF NOT EXISTS "costPerPiece" double precision`);

    await queryRunner.query(`
      UPDATE "flavors"
      SET "normalizedName" = lower(trim(regexp_replace(coalesce("name", ''), '\\s+', ' ', 'g')))
      WHERE "normalizedName" IS NULL
    `);

    await queryRunner.query(`
      WITH grouped AS (
        SELECT
          MIN("id") AS keep_id,
          "shopId",
          "flavorId",
          SUM(coalesce("quantity", 0)) AS total_quantity,
          SUM(coalesce("reservedQuantity", 0)) AS total_reserved,
          MAX(coalesce("costPrice", 0)) AS merged_cost
        FROM "stock_items"
        GROUP BY "shopId", "flavorId"
      )
      UPDATE "stock_items" s
      SET
        "quantity" = g.total_quantity,
        "reservedQuantity" = g.total_reserved,
        "costPrice" = g.merged_cost
      FROM grouped g
      WHERE s."id" = g.keep_id
    `);

    await queryRunner.query(`
      WITH grouped AS (
        SELECT MIN("id") AS keep_id, "shopId", "flavorId"
        FROM "stock_items"
        GROUP BY "shopId", "flavorId"
      )
      DELETE FROM "stock_items" s
      USING grouped g
      WHERE s."shopId" = g."shopId"
        AND s."flavorId" = g."flavorId"
        AND s."id" <> g.keep_id
    `);

    await queryRunner.query(`
      WITH flavor_groups AS (
        SELECT
          MIN("id") AS keep_id,
          "shopId",
          "productFormatId",
          "normalizedName"
        FROM "flavors"
        WHERE "normalizedName" IS NOT NULL
        GROUP BY "shopId", "productFormatId", "normalizedName"
      ),
      dup AS (
        SELECT f."id" AS old_id, fg.keep_id
        FROM "flavors" f
        JOIN flavor_groups fg
          ON f."shopId" = fg."shopId"
         AND f."productFormatId" = fg."productFormatId"
         AND f."normalizedName" = fg."normalizedName"
        WHERE f."id" <> fg.keep_id
      )
      UPDATE "stock_items" s
      SET "flavorId" = d.keep_id
      FROM dup d
      WHERE s."flavorId" = d.old_id
    `);

    await queryRunner.query(`
      WITH flavor_groups AS (
        SELECT
          MIN("id") AS keep_id,
          "shopId",
          "productFormatId",
          "normalizedName"
        FROM "flavors"
        WHERE "normalizedName" IS NOT NULL
        GROUP BY "shopId", "productFormatId", "normalizedName"
      ),
      dup AS (
        SELECT f."id" AS old_id, fg.keep_id
        FROM "flavors" f
        JOIN flavor_groups fg
          ON f."shopId" = fg."shopId"
         AND f."productFormatId" = fg."productFormatId"
         AND f."normalizedName" = fg."normalizedName"
        WHERE f."id" <> fg.keep_id
      )
      UPDATE "sale_items" s
      SET "flavorId" = d.keep_id
      FROM dup d
      WHERE s."flavorId" = d.old_id
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          "id",
          "shopId",
          "productFormatId",
          "normalizedName",
          ROW_NUMBER() OVER (
            PARTITION BY "shopId", "productFormatId", "normalizedName"
            ORDER BY "createdAt" ASC, "id" ASC
          ) AS rn
        FROM "flavors"
        WHERE "normalizedName" IS NOT NULL
      )
      DELETE FROM "flavors" f
      USING ranked r
      WHERE f."id" = r."id" AND r.rn > 1
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_flavors_shop_format_normalized_name" ON "flavors" ("shopId", "productFormatId", "normalizedName")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_stock_items_shop_flavor" ON "stock_items" ("shopId", "flavorId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_stock_items_shop_flavor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_flavors_shop_format_normalized_name"`);
    await queryRunner.query(`ALTER TABLE "stock_items" DROP COLUMN IF EXISTS "costPerPiece"`);
    await queryRunner.query(`ALTER TABLE "stock_items" DROP COLUMN IF EXISTS "piecesPerPack"`);
    await queryRunner.query(`ALTER TABLE "stock_items" DROP COLUMN IF EXISTS "packCost"`);
    await queryRunner.query(`ALTER TABLE "flavors" DROP COLUMN IF EXISTS "normalizedName"`);
  }
}
