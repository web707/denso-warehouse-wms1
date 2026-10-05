import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('packing_rules')
export class PackingRule extends BaseEntity {
  @Column()
  text: string;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ default: 'Box' })
  icon: string;

  @Column({ default: true })
  active: boolean;

  // System rules seeded from the client requirements file cannot be
  // deleted (only toggled/reworded) — see PackingRulesService.remove().
  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
