import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ContainerType } from '../../container-types/entities/container-type.entity';
import { Order } from '../../orders/entities/order.entity';
import { Part } from '../../parts/entities/part.entity';

@Entity('containers')
export class Container extends BaseEntity {
  @ManyToOne(() => ContainerType, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'container_type_id' })
  containerType: ContainerType;

  @Column({ name: 'container_type_id' })
  containerTypeId: string;

  // Nullable at the DB level only to avoid backfilling pre-existing rows;
  // every container created through the API from now on must set this —
  // each order gets its own fresh set of containers, never shared.
  @ManyToOne(() => Order, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column()
  name: string;

  @Column({ name: 'warehouse_code', default: 'DENSO-WH' })
  warehouseCode: string;

  @Column({ name: 'zone_code', default: 'ZONE-A' })
  zoneCode: string;

  // Overrides ContainerType defaults when set (e.g. a de-rated payload).
  @Column({ name: 'max_cbm_override', type: 'numeric', precision: 8, scale: 3, nullable: true })
  maxCbmOverride: string | null;

  @Column({
    name: 'max_payload_kg_override',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxPayloadKgOverride: string | null;

  @OneToMany(() => Part, (p) => p.container)
  parts: Part[];
}
