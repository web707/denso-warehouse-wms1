import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bổ sung các trường theo dữ liệu Oracle Fusion Cloud Inventory (Khâu 2):
 * LotNumber, UOMCode, UnitCost, ExpirationDate, SupplierName/Id/SiteCode.
 * Tất cả cho phép NULL (riêng uom_code mặc định 'EA') nên dữ liệu cũ không bị ảnh hưởng.
 */
export class AddOracleInventoryFieldsToParts1787200000000 implements MigrationInterface {
  name = 'AddOracleInventoryFieldsToParts1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "parts" ADD "lot_number" character varying`);
    await queryRunner.query(`ALTER TABLE "parts" ADD "uom_code" character varying NOT NULL DEFAULT 'EA'`);
    await queryRunner.query(`ALTER TABLE "parts" ADD "unit_cost" numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "parts" ADD "expiration_date" date`);
    await queryRunner.query(`ALTER TABLE "parts" ADD "supplier_name" character varying`);
    await queryRunner.query(`ALTER TABLE "parts" ADD "supplier_id" integer`);
    await queryRunner.query(`ALTER TABLE "parts" ADD "supplier_site_code" character varying`);
    await queryRunner.query(`CREATE INDEX "IDX_parts_lot_number" ON "parts" ("lot_number")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_parts_lot_number"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN "supplier_site_code"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN "supplier_id"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN "supplier_name"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN "expiration_date"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN "unit_cost"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN "uom_code"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN "lot_number"`);
  }
}
