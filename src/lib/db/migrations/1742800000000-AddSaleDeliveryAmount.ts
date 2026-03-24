import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleDeliveryAmount1742800000000 implements MigrationInterface {
  name = 'AddSaleDeliveryAmount1742800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'sales'`
    );
    if (!Array.isArray(tableExists) || tableExists.length === 0) {
      return;
    }
    await queryRunner.query(
      `ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "deliveryAmount" double precision NOT NULL DEFAULT 0`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "deliveryAmount"`);
  }
}
