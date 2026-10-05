import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Container } from '../../containers/entities/container.entity';
import { Violation, BlockSummary } from '../domain/types';
import { CartonPlacement } from './carton-placement.entity';

@Entity('load_plans')
// Partial unique index: at most one "current" plan per container. Created
// in the migration as: CREATE UNIQUE INDEX ... ON load_plans (container_id) WHERE is_current;
export class LoadPlan extends BaseEntity {
  @ManyToOne(() => Container, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'container_id' })
  container: Container;

  @Index()
  @Column({ name: 'container_id' })
  containerId: string;

  @Column({ name: 'is_current', default: true })
  isCurrent: boolean;

  @Column({ name: 'wall_count', type: 'int' })
  wallCount: number;

  @Column({ name: 'layer_count', type: 'int' })
  layerCount: number;

  @Column({ name: 'cbm_used', type: 'numeric', precision: 10, scale: 6 })
  cbmUsed: string;

  @Column({ name: 'weight_used_kg', type: 'numeric', precision: 10, scale: 2 })
  weightUsedKg: string;

  @Column({ type: 'jsonb' })
  blocks: BlockSummary[];

  @Column({ type: 'jsonb' })
  violations: Violation[];

  @OneToMany(() => CartonPlacement, (p) => p.loadPlan)
  placements: CartonPlacement[];
}
