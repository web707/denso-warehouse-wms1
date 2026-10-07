import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

export const INSPECTION_TYPES = ['INCOMING', 'IN-PROCESS', 'FINAL'] as const;
export const JUDGMENTS = ['OK', 'NG', 'HOLD'] as const;
export type Judgment = (typeof JUDGMENTS)[number];

const measure = { type: 'numeric' as const, precision: 14, scale: 4, nullable: true, transformer: numericTransformer };

/**
 * Khâu 4 — Kiểm tra chất lượng. Lưu ý: theo tài liệu thu thập, field của khâu này là MOCK
 * (DENSO/Oracle không công bố), dựng theo chuẩn IATF 16949.
 */
@Entity('inspections')
export class Inspection extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'inspection_id' })
  inspectionId: string;

  @Index()
  @Column({ name: 'lot_number' })
  lotNumber: string;

  @Index()
  @Column({ name: 'work_order_number', type: 'varchar', nullable: true })
  workOrderNumber: string | null;

  @Column({ name: 'inspection_type', default: 'INCOMING' })
  inspectionType: string;

  @Column({ name: 'inspection_date', type: 'timestamptz', default: () => 'now()' })
  inspectionDate: Date;

  @Column({ name: 'sample_size', type: 'int', default: 0 })
  sampleSize: number;

  @Column({ name: 'pass_quantity', type: 'int', default: 0 })
  passQuantity: number;

  @Column({ name: 'fail_quantity', type: 'int', default: 0 })
  failQuantity: number;

  @Index()
  @Column({ default: 'OK' })
  judgment: string;

  @Column({ name: 'defect_code', type: 'varchar', nullable: true })
  defectCode: string | null;

  @Column({ name: 'measured_value_1', ...measure })
  measuredValue1: number | null;

  @Column({ name: 'upper_tolerance', ...measure })
  upperTolerance: number | null;

  @Column({ name: 'lower_tolerance', ...measure })
  lowerTolerance: number | null;

  @Column({ name: 'inspector_id', type: 'varchar', nullable: true })
  inspectorId: string | null;
}
