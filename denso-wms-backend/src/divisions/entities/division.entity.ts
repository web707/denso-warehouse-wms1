import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { DcPrefix } from './dc-prefix.entity';

@Entity('divisions')
export class Division extends BaseEntity {
  @Index({ unique: true })
  @Column()
  code: string; // HG | MAR | TJM

  @Column()
  name: string; // HomeGoods | Marshalls | TJ Maxx

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number; // loading sequence: 1=HG, 2=MAR, 3=TJM

  @Column({ name: 'color_hex', type: 'varchar', nullable: true })
  colorHex: string | null;

  @OneToMany(() => DcPrefix, (p) => p.division)
  dcPrefixes: DcPrefix[];
}
