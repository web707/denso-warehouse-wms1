import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Container } from '../containers/entities/container.entity';
import { WarehouseZone } from './entities/warehouse-zone.entity';
import { WarehouseZonesController } from './warehouse-zones.controller';
import { WarehouseZonesService } from './warehouse-zones.service';

@Module({
  imports: [TypeOrmModule.forFeature([WarehouseZone, Container])],
  controllers: [WarehouseZonesController],
  providers: [WarehouseZonesService],
})
export class WarehouseZonesModule {}
