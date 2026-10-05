import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackingRule } from './entities/packing-rule.entity';
import { PackingRulesController } from './packing-rules.controller';
import { PackingRulesService } from './packing-rules.service';

@Module({
  imports: [TypeOrmModule.forFeature([PackingRule])],
  controllers: [PackingRulesController],
  providers: [PackingRulesService],
  exports: [TypeOrmModule],
})
export class PackingRulesModule {}
