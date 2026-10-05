import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Part } from '../../parts/entities/part.entity';
import { LoadPlan } from './load-plan.entity';

@Entity('carton_placements')
// A cell (wall/layer/column) can only ever hold one carton within a plan.
@Unique(['loadPlanId', 'wallIndex', 'layer', 'column'])
export class CartonPlacement extends BaseEntity {
  @ManyToOne(() => LoadPlan, (p) => p.placements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'load_plan_id' })
  loadPlan: LoadPlan;

  @Index()
  @Column({ name: 'load_plan_id' })
  loadPlanId: string;

  @ManyToOne(() => Part, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'part_id' })
  part: Part;

  @Index()
  @Column({ name: 'part_id' })
  partId: string;

  @Column({ name: 'block_index', type: 'int' })
  blockIndex: number;

  @Column({ name: 'carton_seq', type: 'int' })
  cartonSeq: number;

  // "Row" in the client's coordinate sheet.
  @Column({ name: 'wall_index', type: 'int' })
  wallIndex: number;

  @Column({ type: 'int' })
  layer: number;

  @Column({ type: 'int' })
  column: number;

  @Column({ name: 'x_mm', type: 'int' })
  xMm: number;

  @Column({ name: 'y_mm', type: 'int' })
  yMm: number;

  @Column({ name: 'z_mm', type: 'int' })
  zMm: number;

  @Column({ name: 'dx_mm', type: 'int' })
  dxMm: number;

  @Column({ name: 'dy_mm', type: 'int' })
  dyMm: number;

  @Column({ name: 'dz_mm', type: 'int' })
  dzMm: number;

  @Column({ default: false })
  rotated: boolean;

  @Column({ name: 'color_hex' })
  colorHex: string;
}
