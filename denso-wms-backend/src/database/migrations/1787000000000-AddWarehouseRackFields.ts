import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWarehouseRackFields1787000000000 implements MigrationInterface {
  name = 'AddWarehouseRackFields1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "containers" ADD "warehouse_code" character varying NOT NULL DEFAULT 'DENSO-WH'`);
    await queryRunner.query(`ALTER TABLE "containers" ADD "zone_code" character varying NOT NULL DEFAULT 'ZONE-A'`);
    await queryRunner.query(`ALTER TABLE "parts" ADD "preferred_rack_slot" integer`);
    await queryRunner.query(`CREATE INDEX "IDX_parts_preferred_rack_slot" ON "parts" ("preferred_rack_slot")`);
    await queryRunner.query(`UPDATE "packing_rules" SET "text" = REPLACE(REPLACE("text", 'container', 'kệ'), 'Container', 'Kệ') WHERE "text" ILIKE '%container%'`);
    await queryRunner.query(`UPDATE "container_types" SET "code" = CASE "code" WHEN '20DC' THEN 'RACK20-A' WHEN '20HC' THEN 'RACK20-B' WHEN '40DC' THEN 'RACK20-C' WHEN '45HC' THEN 'RACK20-D' ELSE "code" END, "label" = CASE "code" WHEN '20DC' THEN 'Kệ công nghiệp 20 ô - Khu A' WHEN '20HC' THEN 'Kệ công nghiệp 20 ô - Khu B' WHEN '40DC' THEN 'Kệ công nghiệp 20 ô - Khu C' WHEN '45HC' THEN 'Kệ công nghiệp 20 ô - Khu D' ELSE "label" END, "internal_length_mm" = 6500, "internal_width_mm" = 900, "internal_height_mm" = 3000, "door_width_mm" = NULL, "door_height_mm" = NULL, "max_cbm" = 17.550, "max_payload_kg" = 10000.00`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_parts_preferred_rack_slot"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP COLUMN "preferred_rack_slot"`);
    await queryRunner.query(`ALTER TABLE "containers" DROP COLUMN "zone_code"`);
    await queryRunner.query(`ALTER TABLE "containers" DROP COLUMN "warehouse_code"`);
  }
}
