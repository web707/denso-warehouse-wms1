import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('container_types')
export class ContainerType extends BaseEntity {
  @Index({ unique: true })
  @Column()
  code: string; // 20DC | 20HC | 40DC | 45HC

  @Column()
  label: string;

  @Column({ name: 'internal_length_mm', type: 'int' })
  internalLengthMm: number;

  @Column({ name: 'internal_width_mm', type: 'int' })
  internalWidthMm: number;

  @Column({ name: 'internal_height_mm', type: 'int' })
  internalHeightMm: number;

  @Column({ name: 'door_width_mm', type: 'int', nullable: true })
  doorWidthMm: number | null;

  @Column({ name: 'door_height_mm', type: 'int', nullable: true })
  doorHeightMm: number | null;

  @Column({ name: 'max_cbm', type: 'numeric', precision: 8, scale: 3 })
  maxCbm: string;

  @Column({ name: 'max_payload_kg', type: 'numeric', precision: 10, scale: 2 })
  maxPayloadKg: string;

  @Column({ name: 'tare_weight_kg', type: 'numeric', precision: 10, scale: 2, nullable: true })
  tareWeightKg: string | null;
}
