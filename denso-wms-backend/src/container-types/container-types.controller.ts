import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContainerType } from './entities/container-type.entity';

@ApiTags('rack-types')
@Controller('rack-types')
export class ContainerTypesController {
  constructor(@InjectRepository(ContainerType) private readonly types: Repository<ContainerType>) {}

  @Get()
  async findAll(): Promise<any[]> {
    const rows = await this.types.find({ order: { code: 'ASC' } });
    return rows.map((t, index) => ({
      id: t.id,
      code: `RACK20-${index + 1}`,
      label: `Kệ công nghiệp 20 ô · Cấu hình ${index + 1}`,
      bayCount: 5,
      levelCount: 4,
      slotCount: 20,
      slotWidthMm: 1300,
      slotDepthMm: 900,
      slotHeightMm: 750,
      maxWeightPerSlotKg: 500,
      maxCbm: t.maxCbm,
      maxPayloadKg: t.maxPayloadKg,
      sourceCode: t.code,
    }));
  }
}
