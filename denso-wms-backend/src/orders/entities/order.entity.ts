import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Container } from '../../containers/entities/container.entity';
import { Part } from '../../parts/entities/part.entity';

export enum OrderStatus {
  DRAFT = 'draft',
  ALLOCATED = 'allocated',
  EXPORTED = 'exported',
}

@Entity('orders')
export class Order extends BaseEntity {
  @Column({ name: 'order_number' })
  orderNumber: string;

  // Display label for the container-allocation tab — independent of
  // orderNumber. Defaults to the orderNumber, or to the imported file's
  // name (extension stripped) when created via xlsx import.
  @Column()
  name: string;

  // Free-text customer/brand label (e.g. "PAV"). NOT used for load
  // sequencing — that comes from Part.division/dcPrefix/masterPo.
  @Column()
  division: string;

  @Column({ default: 'USA' })
  destination: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  @OneToMany(() => Part, (p) => p.order)
  parts: Part[];

  @OneToMany(() => Container, (c) => c.order)
  containers: Container[];
}
