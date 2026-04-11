import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientErrorLogs1760300000000 implements MigrationInterface {
  name = 'ClientErrorLogs1760300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "client_error_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "shopId" uuid,
        "userId" uuid,
        "kind" character varying NOT NULL DEFAULT 'runtime',
        "message" character varying(500) NOT NULL,
        "stack" text,
        "href" character varying(2000),
        "userAgent" character varying(512),
        CONSTRAINT "PK_client_error_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_client_error_logs_createdAt" ON "client_error_logs" ("createdAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_client_error_logs_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "client_error_logs"`);
  }
}
