import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrandPhotoUrl1731930000000 implements MigrationInterface {
  name = 'AddBrandPhotoUrl1731930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'brands'`
    );
    if (!Array.isArray(tableExists) || tableExists.length === 0) {
      return;
    }
    const hasColumn = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'photoUrl'`
    );
    if (Array.isArray(hasColumn) && hasColumn.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "brands" ADD "photoUrl" character varying`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "photoUrl"`);
  }
}
