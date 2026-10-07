import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Khâu 1 (work_orders), Khâu 4 (inspections), Khâu 5 (shipments) theo dữ liệu Oracle Fusion SCM.
 * Các bảng liên kết với nhau và với bảng parts bằng LotNumber / ItemNumber / WorkOrderNumber (không dùng FK cứng
 * vì dữ liệu từ Oracle có thể đến theo thứ tự bất kỳ).
 */
export class AddSupplyChainTables1787300000000 implements MigrationInterface {
  name = 'AddSupplyChainTables1787300000000';

  public async up(q: QueryRunner): Promise<void> {
    const base = `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`;

    await q.query(`CREATE TABLE "work_orders" (${base},
      "work_order_number" character varying NOT NULL,
      "work_order_type" character varying NOT NULL DEFAULT 'STANDARD',
      "work_order_status" character varying NOT NULL DEFAULT 'UNRELEASED',
      "item_number" character varying NOT NULL,
      "inventory_item_id" integer,
      "organization_code" character varying NOT NULL DEFAULT 'DENSO-WH',
      "planned_start_date" TIMESTAMP WITH TIME ZONE,
      "planned_completion_date" TIMESTAMP WITH TIME ZONE,
      "actual_start_date" TIMESTAMP WITH TIME ZONE,
      "actual_completion_date" TIMESTAMP WITH TIME ZONE,
      "planned_start_quantity" numeric(14,3) NOT NULL DEFAULT 0,
      "completed_quantity" numeric(14,3) NOT NULL DEFAULT 0,
      "scrapped_quantity" numeric(14,3) NOT NULL DEFAULT 0,
      "in_process_quantity" numeric(14,3) NOT NULL DEFAULT 0,
      "lot_number" character varying,
      "work_definition_code" character varying,
      "work_center_code" character varying,
      "work_center_name" character varying,
      "operation_sequence_number" integer,
      "operation_status" character varying,
      "resource_code" character varying,
      "customer_number" character varying,
      "customer_name" character varying,
      "demand_source_header_number" character varying,
      "firm_planned_flag" boolean NOT NULL DEFAULT false,
      "expedited_flag" boolean NOT NULL DEFAULT false,
      "due_date" TIMESTAMP WITH TIME ZONE,
      CONSTRAINT "PK_work_orders" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_work_orders_number" ON "work_orders" ("work_order_number")`);
    await q.query(`CREATE INDEX "IDX_work_orders_status" ON "work_orders" ("work_order_status")`);
    await q.query(`CREATE INDEX "IDX_work_orders_item" ON "work_orders" ("item_number")`);
    await q.query(`CREATE INDEX "IDX_work_orders_lot" ON "work_orders" ("lot_number")`);

    await q.query(`CREATE TABLE "inspections" (${base},
      "inspection_id" character varying NOT NULL,
      "lot_number" character varying NOT NULL,
      "work_order_number" character varying,
      "inspection_type" character varying NOT NULL DEFAULT 'INCOMING',
      "inspection_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "sample_size" integer NOT NULL DEFAULT 0,
      "pass_quantity" integer NOT NULL DEFAULT 0,
      "fail_quantity" integer NOT NULL DEFAULT 0,
      "judgment" character varying NOT NULL DEFAULT 'OK',
      "defect_code" character varying,
      "measured_value_1" numeric(14,4),
      "upper_tolerance" numeric(14,4),
      "lower_tolerance" numeric(14,4),
      "inspector_id" character varying,
      CONSTRAINT "PK_inspections" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_inspections_inspection_id" ON "inspections" ("inspection_id")`);
    await q.query(`CREATE INDEX "IDX_inspections_lot" ON "inspections" ("lot_number")`);
    await q.query(`CREATE INDEX "IDX_inspections_judgment" ON "inspections" ("judgment")`);
    await q.query(`CREATE INDEX "IDX_inspections_wo" ON "inspections" ("work_order_number")`);

    await q.query(`CREATE TABLE "shipments" (${base},
      "shipment_number" character varying NOT NULL,
      "customer_number" character varying,
      "customer_name" character varying NOT NULL,
      "requested_ship_date" TIMESTAMP WITH TIME ZONE,
      "actual_ship_date" TIMESTAMP WITH TIME ZONE,
      "shipment_status" character varying NOT NULL DEFAULT 'RELEASED',
      "carrier_code" character varying,
      "tracking_number" character varying,
      "gross_weight" numeric(14,3),
      "weight_uom_code" character varying NOT NULL DEFAULT 'KG',
      "shipped_quantity" numeric(14,3) NOT NULL DEFAULT 0,
      "lot_number" character varying,
      "item_number" character varying NOT NULL,
      "source_order_number" character varying,
      CONSTRAINT "PK_shipments" PRIMARY KEY ("id"))`);
    await q.query(`CREATE UNIQUE INDEX "UQ_shipments_number" ON "shipments" ("shipment_number")`);
    await q.query(`CREATE INDEX "IDX_shipments_status" ON "shipments" ("shipment_status")`);
    await q.query(`CREATE INDEX "IDX_shipments_lot" ON "shipments" ("lot_number")`);
    await q.query(`CREATE INDEX "IDX_shipments_item" ON "shipments" ("item_number")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "shipments"`);
    await q.query(`DROP TABLE "inspections"`);
    await q.query(`DROP TABLE "work_orders"`);
  }
}
