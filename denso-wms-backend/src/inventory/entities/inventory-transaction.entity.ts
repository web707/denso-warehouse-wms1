import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Container } from '../../containers/entities/container.entity';
import { Order } from '../../orders/entities/order.entity';
import { Part } from '../../parts/entities/part.entity';

export enum InventoryTransactionType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  TRANSFER = 'transfer',
}

@Entity('inventory_transactions')
export class InventoryTransaction extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 20 })
  type: InventoryTransactionType;

  @ManyToOne(() => Part, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'part_id' })
  part: Part | null;

  @Index()
  @Column({ name: 'part_id', type: 'uuid', nullable: true })
  partId: string | null;

  @Column({ name: 'part_name' })
  partName: string;

  @Column({ name: 'product_code', type: 'varchar', nullable: true })
  productCode: string | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Index()
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Container, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_rack_id' })
  fromRack: Container | null;

  @Column({ name: 'from_rack_id', type: 'uuid', nullable: true })
  fromRackId: string | null;

  @Column({ name: 'from_slot', type: 'int', nullable: true })
  fromSlot: number | null;

  @ManyToOne(() => Container, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_rack_id' })
  toRack: Container | null;

  @Column({ name: 'to_rack_id', type: 'uuid', nullable: true })
  toRackId: string | null;

  @Column({ name: 'to_slot', type: 'int', nullable: true })
  toSlot: number | null;

  @Column({ name: 'quantity_pcs', type: 'int', default: 0 })
  quantityPcs: number;

  @Column({ name: 'carton_count', type: 'int', default: 0 })
  cartonCount: number;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 12, scale: 2, default: 0 })
  weightKg: string;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedBy: string | null;

  @Column({ name: 'performed_by_email', type: 'varchar', nullable: true })
  performedByEmail: string | null;
}
