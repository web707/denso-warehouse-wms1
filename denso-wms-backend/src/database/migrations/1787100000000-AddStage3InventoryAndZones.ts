import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStage3InventoryAndZones1787100000000 implements MigrationInterface {
  name = 'AddStage3InventoryAndZones1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "warehouse_zones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "warehouse_code" character varying NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_warehouse_zones" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_warehouse_zone_code" ON "warehouse_zones" ("warehouse_code", "code")`);
    await queryRunner.query(`INSERT INTO "warehouse_zones" ("warehouse_code","code","name","description") VALUES ('DENSO-WH','ZONE-A','Khu A','Khu lưu trữ chính'), ('DENSO-WH','ZONE-B','Khu B','Khu dự phòng / linh kiện điện'), ('DENSO-WH','ZONE-C','Khu C','Khu dự phòng / linh kiện cơ khí') ON CONFLICT DO NOTHING`);

    await queryRunner.query(`CREATE TABLE "inventory_transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" character varying(20) NOT NULL, "part_id" uuid, "part_name" character varying NOT NULL, "product_code" character varying, "order_id" uuid, "from_rack_id" uuid, "from_slot" integer, "to_rack_id" uuid, "to_slot" integer, "quantity_pcs" integer NOT NULL DEFAULT 0, "carton_count" integer NOT NULL DEFAULT 0, "weight_kg" numeric(12,2) NOT NULL DEFAULT 0, "note" character varying, "performed_by" uuid, "performed_by_email" character varying, CONSTRAINT "PK_inventory_transactions" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_inventory_tx_type" ON "inventory_transactions" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_inventory_tx_part" ON "inventory_transactions" ("part_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_inventory_tx_order" ON "inventory_transactions" ("order_id")`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_inventory_tx_part" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_inventory_tx_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_inventory_tx_from_rack" FOREIGN KEY ("from_rack_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_inventory_tx_to_rack" FOREIGN KEY ("to_rack_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "inventory_transactions"`);
    await queryRunner.query(`DROP TABLE "warehouse_zones"`);
  }
}
