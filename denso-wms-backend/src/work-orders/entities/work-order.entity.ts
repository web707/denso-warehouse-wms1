import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

export const WORK_ORDER_TYPES = ['STANDARD', 'REWORK', 'TRANSFORM'] as const;
export const WORK_ORDER_STATUSES = ['UNRELEASED', 'RELEASED', 'COMPLETED', 'ON_HOLD', 'CANCELLED'] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

const qty = { type: 'numeric' as const, precision: 14, scale: 3, transformer: numericTransformer };

/** Khâu 1 — Lệnh sản xuất (Oracle Fusion Manufacturing: workOrders). */
@Entity('work_orders')
export class WorkOrder extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'work_order_number' })
  workOrderNumber: string;

  @Column({ name: 'work_order_type', default: 'STANDARD' })
  workOrderType: string;

  @Index()
  @Column({ name: 'work_order_status', default: 'UNRELEASED' })
  workOrderStatus: string;

  @Index()
  @Column({ name: 'item_number' })
  itemNumber: string;

  @Column({ name: 'inventory_item_id', type: 'int', nullable: true })
  inventoryItemId: number | null;

  @Column({ name: 'organization_code', default: 'DENSO-WH' })
  organizationCode: string;

  @Column({ name: 'planned_start_date', type: 'timestamptz', nullable: true })
  plannedStartDate: Date | null;

  @Column({ name: 'planned_completion_date', type: 'timestamptz', nullable: true })
  plannedCompletionDate: Date | null;

  @Column({ name: 'actual_start_date', type: 'timestamptz', nullable: true })
  actualStartDate: Date | null;

  @Column({ name: 'actual_completion_date', type: 'timestamptz', nullable: true })
  actualCompletionDate: Date | null;

  @Column({ name: 'planned_start_quantity', ...qty, default: 0 })
  plannedStartQuantity: number;

  @Column({ name: 'completed_quantity', ...qty, default: 0 })
  completedQuantity: number;

  @Column({ name: 'scrapped_quantity', ...qty, default: 0 })
  scrappedQuantity: number;

  @Column({ name: 'in_process_quantity', ...qty, default: 0 })
  inProcessQuantity: number;

  @Index()
  @Column({ name: 'lot_number', type: 'varchar', nullable: true })
  lotNumber: string | null;

  @Column({ name: 'work_definition_code', type: 'varchar', nullable: true })
  workDefinitionCode: string | null;

  @Column({ name: 'work_center_code', type: 'varchar', nullable: true })
  workCenterCode: string | null;

  @Column({ name: 'work_center_name', type: 'varchar', nullable: true })
  workCenterName: string | null;

  @Column({ name: 'operation_sequence_number', type: 'int', nullable: true })
  operationSequenceNumber: number | null;

  @Column({ name: 'operation_status', type: 'varchar', nullable: true })
  operationStatus: string | null;

  @Column({ name: 'resource_code', type: 'varchar', nullable: true })
  resourceCode: string | null;

  @Column({ name: 'customer_number', type: 'varchar', nullable: true })
  customerNumber: string | null;

  @Column({ name: 'customer_name', type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ name: 'demand_source_header_number', type: 'varchar', nullable: true })
  demandSourceHeaderNumber: string | null;

  @Column({ name: 'firm_planned_flag', default: false })
  firmPlannedFlag: boolean;

  @Column({ name: 'expedited_flag', default: false })
  expeditedFlag: boolean;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate: Date | null;
}
