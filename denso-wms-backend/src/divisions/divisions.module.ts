import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DivisionsController } from './divisions.controller';
import { DcPrefix } from './entities/dc-prefix.entity';
import { Division } from './entities/division.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Division, DcPrefix])],
  controllers: [DivisionsController],
  exports: [TypeOrmModule],
})
export class DivisionsModule {}
