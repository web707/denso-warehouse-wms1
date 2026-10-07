import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Oracle Shipping có ShipmentId kiểu số nguyên. Bảng shipments dùng uuid làm khóa chính nên
 * thêm cột shipment_id tự tăng (sequence) để xuất đúng định dạng Oracle và làm số điều khiển EDI.
 * Các lô giao đã có sẽ được đánh số theo thứ tự tạo.
 */
export class AddShipmentIdToShipments1787400000000 implements MigrationInterface {
  name = 'AddShipmentIdToShipments1787400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE SEQUENCE "shipments_shipment_id_seq" AS integer`);
    await q.query(`ALTER TABLE "shipments" ADD "shipment_id" integer`);
    await q.query(`
      UPDATE "shipments" s SET "shipment_id" = n.rn
      FROM (SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn FROM "shipments") n
      WHERE s."id" = n."id"`);
    await q.query(`SELECT setval('shipments_shipment_id_seq', COALESCE((SELECT MAX("shipment_id") FROM "shipments"), 0) + 1, false)`);
    await q.query(`ALTER TABLE "shipments" ALTER COLUMN "shipment_id" SET DEFAULT nextval('shipments_shipment_id_seq')`);
    await q.query(`ALTER TABLE "shipments" ALTER COLUMN "shipment_id" SET NOT NULL`);
    await q.query(`ALTER SEQUENCE "shipments_shipment_id_seq" OWNED BY "shipments"."shipment_id"`);
    await q.query(`CREATE UNIQUE INDEX "UQ_shipments_shipment_id" ON "shipments" ("shipment_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "public"."UQ_shipments_shipment_id"`);
    await q.query(`ALTER TABLE "shipments" DROP COLUMN "shipment_id"`);
  }
}
