import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderScopingToContainersAndHistory1785591384811 implements MigrationInterface {
  name = 'AddOrderScopingToContainersAndHistory1785591384811';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Note: the load_plans partial-unique-index drop/recreate that
    // migration:generate proposed here was spurious (a quoting-style
    // diff against the InitSchema-created index, not a real schema
    // change) and has been removed from this migration.
    await queryRunner.query(`ALTER TABLE "orders" ADD "name" character varying`);
    await queryRunner.query(`UPDATE "orders" SET "name" = "order_number" WHERE "name" IS NULL`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "name" SET NOT NULL`);
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('draft', 'allocated', 'exported')`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "status" "public"."orders_status_enum" NOT NULL DEFAULT 'draft'`,
    );
    await queryRunner.query(`ALTER TABLE "containers" ADD "order_id" uuid`);
    await queryRunner.query(`ALTER TABLE "history_events" ADD "order_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_a2039e1070802c09adb259a7a5" ON "history_events" ("order_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "containers" ADD CONSTRAINT "FK_6093e7a0b2f6fcf84938dc76cea" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "containers" DROP CONSTRAINT "FK_6093e7a0b2f6fcf84938dc76cea"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_a2039e1070802c09adb259a7a5"`);
    await queryRunner.query(`ALTER TABLE "history_events" DROP COLUMN "order_id"`);
    await queryRunner.query(`ALTER TABLE "containers" DROP COLUMN "order_id"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "name"`);
  }
}
