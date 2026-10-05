import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum HistoryEventType {
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_DELETED = 'order_deleted',
  PART_ADDED = 'part_added',
  PART_UPDATED = 'part_updated',
  PART_DELETED = 'part_deleted',
  PART_ASSIGNED = 'part_assigned',
  CONTAINER_CREATED = 'container_created',
  CONTAINER_UPDATED = 'container_updated',
  CONTAINER_DELETED = 'container_deleted',
  RULE_ADDED = 'rule_added',
  RULE_UPDATED = 'rule_updated',
  RULE_DELETED = 'rule_deleted',
  IMPORT = 'import',
  EXPORT = 'export',
  SOLVE = 'solve',
}

@Entity('history_events')
export class HistoryEvent extends BaseEntity {
  @Index()
  @Column({ type: 'enum', enum: HistoryEventType })
  type: HistoryEventType;

  @Column()
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Index()
  @Column({ type: 'timestamptz' })
  timestamp: Date;
}
