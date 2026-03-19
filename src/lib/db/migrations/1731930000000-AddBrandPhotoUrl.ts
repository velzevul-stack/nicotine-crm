import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrandPhotoUrl1731930000000 implements MigrationInterface {
  name = 'AddBrandPhotoUrl1731930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "brands" ADD "photoUrl" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN "photoUrl"`);
  }
}
