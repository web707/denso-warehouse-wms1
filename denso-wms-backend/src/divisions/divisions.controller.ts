import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Division } from './entities/division.entity';

@ApiTags('divisions')
@Controller('divisions')
export class DivisionsController {
  constructor(@InjectRepository(Division) private readonly divisions: Repository<Division>) {}

  @Get()
  findAll(): Promise<Division[]> {
    return this.divisions.find({
      relations: { dcPrefixes: true },
      order: { sortOrder: 'ASC', dcPrefixes: { sortOrder: 'ASC' } },
    });
  }
}
