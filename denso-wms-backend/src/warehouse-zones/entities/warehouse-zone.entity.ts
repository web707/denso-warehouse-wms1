import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('warehouse_zones')
@Index(['warehouseCode', 'code'], { unique: true })
export class WarehouseZone extends BaseEntity {
  @Column({ name: 'warehouse_code' })
  warehouseCode: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ default: true })
  active: boolean;
}
