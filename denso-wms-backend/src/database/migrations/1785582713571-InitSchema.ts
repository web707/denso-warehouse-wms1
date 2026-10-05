import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1785582713571 implements MigrationInterface {
  name = 'InitSchema1785582713571';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "container_types" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying NOT NULL, "label" character varying NOT NULL, "internal_length_mm" integer NOT NULL, "internal_width_mm" integer NOT NULL, "internal_height_mm" integer NOT NULL, "door_width_mm" integer, "door_height_mm" integer, "max_cbm" numeric(8,3) NOT NULL, "max_payload_kg" numeric(10,2) NOT NULL, "tare_weight_kg" numeric(10,2), CONSTRAINT "PK_50e6b62fcd07ba58bdb6415d47c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_15cbe97e289785db7a2d13af4a" ON "container_types" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "containers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "container_type_id" uuid NOT NULL, "name" character varying NOT NULL, "max_cbm_override" numeric(8,3), "max_payload_kg_override" numeric(10,2), CONSTRAINT "PK_21cbac3e68f7b1cf53d39cda70c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "divisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying NOT NULL, "name" character varying NOT NULL, "sort_order" integer NOT NULL, "color_hex" character varying, CONSTRAINT "PK_c1f864477b3fd0954564108ed96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b96faa3f412978357707758c83" ON "divisions" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "dc_prefixes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "division_id" uuid NOT NULL, "code" character varying(2) NOT NULL, "sort_order" integer NOT NULL, CONSTRAINT "UQ_5ba5cb44fc64e9c072c3248906b" UNIQUE ("division_id", "code"), CONSTRAINT "PK_5898780f984dda1f01d299448ed" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4e4c4f8403695159f7ce782bf0" ON "dc_prefixes" ("division_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_number" character varying NOT NULL, "division" character varying NOT NULL, "destination" character varying NOT NULL DEFAULT 'USA', CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "parts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "part_name" character varying NOT NULL, "product_code" character varying, "division_id" uuid NOT NULL, "dc_prefix_id" uuid NOT NULL, "master_po" character varying NOT NULL, "quantity_pcs" integer NOT NULL, "total_weight_kg" numeric(10,2) NOT NULL, "carton_count" integer NOT NULL, "carton_length_mm" integer NOT NULL, "carton_width_mm" integer NOT NULL, "carton_height_mm" integer NOT NULL, "cbm" numeric(12,6) NOT NULL, "container_id" uuid, "color_hex" character varying NOT NULL, CONSTRAINT "PK_daa5595bb8933f49ac00c9ebc79" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1873128d26aa2308d1709aeb83" ON "parts" ("order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eefdd99749bb5ee077feb5e1d2" ON "parts" ("division_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e312293c5f85c2d6c7a5eea4d0" ON "parts" ("dc_prefix_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_02bb7de5f74856a3c02a6702f7" ON "parts" ("container_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "packing_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "text" character varying NOT NULL, "category" character varying, "icon" character varying NOT NULL DEFAULT 'Box', "active" boolean NOT NULL DEFAULT true, "is_system" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_b10461113c61d181ec473a247b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "carton_placements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "load_plan_id" uuid NOT NULL, "part_id" uuid NOT NULL, "block_index" integer NOT NULL, "carton_seq" integer NOT NULL, "wall_index" integer NOT NULL, "layer" integer NOT NULL, "column" integer NOT NULL, "x_mm" integer NOT NULL, "y_mm" integer NOT NULL, "z_mm" integer NOT NULL, "dx_mm" integer NOT NULL, "dy_mm" integer NOT NULL, "dz_mm" integer NOT NULL, "rotated" boolean NOT NULL DEFAULT false, "color_hex" character varying NOT NULL, CONSTRAINT "UQ_1abf192292909d829fda7e01c9d" UNIQUE ("load_plan_id", "wall_index", "layer", "column"), CONSTRAINT "PK_6e7277a102306c05bc8ea3d0fb6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_457854182d330e61aa05db8598" ON "carton_placements" ("load_plan_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a30a393bdb8fadacd2c2eab056" ON "carton_placements" ("part_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "load_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "container_id" uuid NOT NULL, "is_current" boolean NOT NULL DEFAULT true, "wall_count" integer NOT NULL, "layer_count" integer NOT NULL, "cbm_used" numeric(10,6) NOT NULL, "weight_used_kg" numeric(10,2) NOT NULL, "blocks" jsonb NOT NULL, "violations" jsonb NOT NULL, CONSTRAINT "PK_db95acc4382ac8f607781970d98" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ca45083d4c0f15432ac1761e8e" ON "load_plans" ("container_id") `,
    );
    // At most one "current" plan per container.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_load_plans_current_per_container" ON "load_plans" ("container_id") WHERE "is_current" = true`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."history_events_type_enum" AS ENUM('order_created', 'order_updated', 'order_deleted', 'part_added', 'part_updated', 'part_deleted', 'part_assigned', 'container_created', 'container_updated', 'container_deleted', 'rule_added', 'rule_updated', 'rule_deleted', 'import', 'export', 'solve')`,
    );
    await queryRunner.query(
      `CREATE TABLE "history_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."history_events_type_enum" NOT NULL, "description" character varying NOT NULL, "details" jsonb, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_37efb8ff48b1d3943482ecc57b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_07d3882fc6487ba5c675a8f33f" ON "history_events" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_405bccd809bba333203c0edc06" ON "history_events" ("timestamp") `,
    );
    await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'user')`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" citext NOT NULL, "password_hash" character varying NOT NULL, "full_name" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "replaced_by_token_hash" character varying, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a7838d2ba25be1342091b6695f" ON "refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_52ac39dd8a28730c63aeb428c9" ON "password_reset_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_91185d86d5d7557b19abbb2868" ON "password_reset_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "containers" ADD CONSTRAINT "FK_528a52b68cb45c690e286a6b03c" FOREIGN KEY ("container_type_id") REFERENCES "container_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "dc_prefixes" ADD CONSTRAINT "FK_4e4c4f8403695159f7ce782bf08" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parts" ADD CONSTRAINT "FK_1873128d26aa2308d1709aeb832" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parts" ADD CONSTRAINT "FK_eefdd99749bb5ee077feb5e1d21" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parts" ADD CONSTRAINT "FK_e312293c5f85c2d6c7a5eea4d07" FOREIGN KEY ("dc_prefix_id") REFERENCES "dc_prefixes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parts" ADD CONSTRAINT "FK_02bb7de5f74856a3c02a6702f75" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "carton_placements" ADD CONSTRAINT "FK_457854182d330e61aa05db85984" FOREIGN KEY ("load_plan_id") REFERENCES "load_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "carton_placements" ADD CONSTRAINT "FK_a30a393bdb8fadacd2c2eab0569" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "load_plans" ADD CONSTRAINT "FK_ca45083d4c0f15432ac1761e8e2" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "load_plans" DROP CONSTRAINT "FK_ca45083d4c0f15432ac1761e8e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "carton_placements" DROP CONSTRAINT "FK_a30a393bdb8fadacd2c2eab0569"`,
    );
    await queryRunner.query(
      `ALTER TABLE "carton_placements" DROP CONSTRAINT "FK_457854182d330e61aa05db85984"`,
    );
    await queryRunner.query(`ALTER TABLE "parts" DROP CONSTRAINT "FK_02bb7de5f74856a3c02a6702f75"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP CONSTRAINT "FK_e312293c5f85c2d6c7a5eea4d07"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP CONSTRAINT "FK_eefdd99749bb5ee077feb5e1d21"`);
    await queryRunner.query(`ALTER TABLE "parts" DROP CONSTRAINT "FK_1873128d26aa2308d1709aeb832"`);
    await queryRunner.query(
      `ALTER TABLE "dc_prefixes" DROP CONSTRAINT "FK_4e4c4f8403695159f7ce782bf08"`,
    );
    await queryRunner.query(
      `ALTER TABLE "containers" DROP CONSTRAINT "FK_528a52b68cb45c690e286a6b03c"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_91185d86d5d7557b19abbb2868"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_52ac39dd8a28730c63aeb428c9"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a7838d2ba25be1342091b6695f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_405bccd809bba333203c0edc06"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_07d3882fc6487ba5c675a8f33f"`);
    await queryRunner.query(`DROP TABLE "history_events"`);
    await queryRunner.query(`DROP TYPE "public"."history_events_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_load_plans_current_per_container"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ca45083d4c0f15432ac1761e8e"`);
    await queryRunner.query(`DROP TABLE "load_plans"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a30a393bdb8fadacd2c2eab056"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_457854182d330e61aa05db8598"`);
    await queryRunner.query(`DROP TABLE "carton_placements"`);
    await queryRunner.query(`DROP TABLE "packing_rules"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_02bb7de5f74856a3c02a6702f7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e312293c5f85c2d6c7a5eea4d0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_eefdd99749bb5ee077feb5e1d2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_1873128d26aa2308d1709aeb83"`);
    await queryRunner.query(`DROP TABLE "parts"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4e4c4f8403695159f7ce782bf0"`);
    await queryRunner.query(`DROP TABLE "dc_prefixes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b96faa3f412978357707758c83"`);
    await queryRunner.query(`DROP TABLE "divisions"`);
    await queryRunner.query(`DROP TABLE "containers"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_15cbe97e289785db7a2d13af4a"`);
    await queryRunner.query(`DROP TABLE "container_types"`);
  }
}
