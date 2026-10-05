import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContainerType } from '../container-types/entities/container-type.entity';
import { HistoryModule } from '../history/history.module';
import { ContainersController } from './containers.controller';
import { ContainersService } from './containers.service';
import { Container } from './entities/container.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Container, ContainerType]), HistoryModule],
  controllers: [ContainersController],
  providers: [ContainersService],
  exports: [TypeOrmModule],
})
export class ContainersModule {}
