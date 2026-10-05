import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContainerTypesController } from './container-types.controller';
import { ContainerType } from './entities/container-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContainerType])],
  controllers: [ContainerTypesController],
  exports: [TypeOrmModule],
})
export class ContainerTypesModule {}
