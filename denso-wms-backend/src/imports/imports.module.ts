import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DcPrefix } from '../divisions/entities/dc-prefix.entity';
import { Division } from '../divisions/entities/division.entity';
import { HistoryModule } from '../history/history.module';
import { Order } from '../orders/entities/order.entity';
import { Part } from '../parts/entities/part.entity';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Division, DcPrefix, Order, Part]), HistoryModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
