import { Column, Entity, Generated, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

export const SHIPMENT_STATUSES = ['RELEASED', 'SHIPPED', 'DELIVERED'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

const qty = { type: 'numeric' as const, precision: 14, scale: 3, transformer: numericTransformer };

/**
 * Khâu 5 — Giao nhận (Oracle Fusion Shipping). Theo tài liệu thu thập: format đã xác nhận,
 * field là MOCK bám chuẩn ngành. DelayDays không lưu mà tính từ ngày yêu cầu/ngày giao thực tế.
 */
@Entity('shipments')
export class Shipment extends BaseEntity {
  /** Oracle: ShipmentId (số nguyên tự tăng). Khóa chính nội bộ vẫn là uuid. */
  @Index({ unique: true })
  @Generated('increment')
  @Column({ name: 'shipment_id', type: 'int' })
  shipmentId: number;

  @Index({ unique: true })
  @Column({ name: 'shipment_number' })
  shipmentNumber: string;

  @Column({ name: 'customer_number', type: 'varchar', nullable: true })
  customerNumber: string | null;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'requested_ship_date', type: 'timestamptz', nullable: true })
  requestedShipDate: Date | null;

  @Column({ name: 'actual_ship_date', type: 'timestamptz', nullable: true })
  actualShipDate: Date | null;

  @Index()
  @Column({ name: 'shipment_status', default: 'RELEASED' })
  shipmentStatus: string;

  @Column({ name: 'carrier_code', type: 'varchar', nullable: true })
  carrierCode: string | null;

  @Column({ name: 'tracking_number', type: 'varchar', nullable: true })
  trackingNumber: string | null;

  @Column({ name: 'gross_weight', ...qty, nullable: true })
  grossWeight: number | null;

  @Column({ name: 'weight_uom_code', default: 'KG' })
  weightUomCode: string;

  @Column({ name: 'shipped_quantity', ...qty, default: 0 })
  shippedQuantity: number;

  @Index()
  @Column({ name: 'lot_number', type: 'varchar', nullable: true })
  lotNumber: string | null;

  @Index()
  @Column({ name: 'item_number' })
  itemNumber: string;

  @Column({ name: 'source_order_number', type: 'varchar', nullable: true })
  sourceOrderNumber: string | null;
}
