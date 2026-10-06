import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Container } from '../../containers/entities/container.entity';
import { DcPrefix } from '../../divisions/entities/dc-prefix.entity';
import { Division } from '../../divisions/entities/division.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('parts')
export class Part extends BaseEntity {
  @ManyToOne(() => Order, (o) => o.parts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index()
  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'part_name' })
  partName: string;

  @Column({ name: 'product_code', type: 'varchar', nullable: true })
  productCode: string | null;

  // Division/DcPrefix/masterPo are the ordering key (Division.sortOrder ->
  // DcPrefix.sortOrder -> masterPo numeric) — see packing/solver.
  @ManyToOne(() => Division, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'division_id' })
  division: Division;

  @Index()
  @Column({ name: 'division_id' })
  divisionId: string;

  @ManyToOne(() => DcPrefix, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dc_prefix_id' })
  dcPrefix: DcPrefix;

  @Index()
  @Column({ name: 'dc_prefix_id' })
  dcPrefixId: string;

  // Kept as string to preserve any leading zeros; compared numerically by the solver.
  @Column({ name: 'master_po' })
  masterPo: string;

  @Column({ name: 'quantity_pcs', type: 'int' })
  quantityPcs: number;

  // Total weight for the WHOLE part (not per carton) — matches the client
  // spreadsheet's WEIGHT (KG) column. Per-carton weight = totalWeightKg / cartonCount.
  @Column({ name: 'total_weight_kg', type: 'numeric', precision: 10, scale: 2 })
  totalWeightKg: string;

  @Column({ name: 'carton_count', type: 'int' })
  cartonCount: number;

  @Column({ name: 'carton_length_mm', type: 'int' })
  cartonLengthMm: number;

  @Column({ name: 'carton_width_mm', type: 'int' })
  cartonWidthMm: number;

  @Column({ name: 'carton_height_mm', type: 'int' })
  cartonHeightMm: number;

  // Maintained by PartsService on create/update (kept as a plain column
  // rather than a DB-generated one for migration simplicity).
  @Column({ name: 'cbm', type: 'numeric', precision: 12, scale: 6 })
  cbm: string;

  @ManyToOne(() => Container, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'container_id' })
  container: Container | null;

  @Index()
  @Column({ name: 'container_id', type: 'uuid', nullable: true })
  containerId: string | null;

  @Column({ name: 'preferred_rack_slot', type: 'int', nullable: true })
  preferredRackSlot: number | null;

  @Column({ name: 'color_hex' })
  colorHex: string;

  // ── Trường theo Oracle Fusion Cloud Inventory (Khâu 2) ──
  // LotNumber: số lô (liên kết với Khâu 3, 4)
  @Index()
  @Column({ name: 'lot_number', type: 'varchar', nullable: true })
  lotNumber: string | null;

  // UOMCode: đơn vị đo (EA, KG, ROLL...)
  @Column({ name: 'uom_code', type: 'varchar', default: 'EA' })
  uomCode: string;

  // UnitCost: giá trị tồn kho trên một đơn vị
  @Column({ name: 'unit_cost', type: 'numeric', precision: 14, scale: 2, nullable: true })
  unitCost: string | null;

  // ExpirationDate: hạn sử dụng (YYYY-MM-DD)
  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: string | null;

  @Column({ name: 'supplier_name', type: 'varchar', nullable: true })
  supplierName: string | null;

  @Column({ name: 'supplier_id', type: 'int', nullable: true })
  supplierId: number | null;

  @Column({ name: 'supplier_site_code', type: 'varchar', nullable: true })
  supplierSiteCode: string | null;
}
