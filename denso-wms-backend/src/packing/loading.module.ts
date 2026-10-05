import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Container } from '../containers/entities/container.entity';
import { ContainerType } from '../container-types/entities/container-type.entity';
import { ExportModule } from '../export/export.module';
import { HistoryModule } from '../history/history.module';
import { Order } from '../orders/entities/order.entity';
import { Part } from '../parts/entities/part.entity';
import { CartonPlacement } from './entities/carton-placement.entity';
import { LoadPlan } from './entities/load-plan.entity';
import { LoadingController } from './loading.controller';
import { LoadingService } from './loading.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Container, ContainerType, Part, LoadPlan, CartonPlacement, Order]),
    HistoryModule,
    ExportModule,
  ],
  controllers: [LoadingController],
  providers: [LoadingService],
  exports: [TypeOrmModule, LoadingService],
})
export class LoadingModule {}
