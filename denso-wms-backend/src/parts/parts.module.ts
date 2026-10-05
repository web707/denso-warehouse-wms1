import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryModule } from '../history/history.module';
import { Container } from '../containers/entities/container.entity';
import { Part } from './entities/part.entity';
import { PartsController } from './parts.controller';
import { PartsService } from './parts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Part, Container]), HistoryModule],
  controllers: [PartsController],
  providers: [PartsService],
  exports: [TypeOrmModule, PartsService],
})
export class PartsModule {}
