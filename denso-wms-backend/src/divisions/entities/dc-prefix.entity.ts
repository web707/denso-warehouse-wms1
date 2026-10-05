import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Division } from './division.entity';

@Entity('dc_prefixes')
@Unique(['divisionId', 'code'])
export class DcPrefix extends BaseEntity {
  @ManyToOne(() => Division, (d) => d.dcPrefixes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'division_id' })
  division: Division;

  @Index()
  @Column({ name: 'division_id' })
  divisionId: string;

  // Kept as a 2-character string (e.g. '01', '10') so a leading zero is
  // never lost — this is a label/sort key, never parsed as a number.
  @Column({ length: 2 })
  code: string;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;
}
