import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePackingRuleDto } from './dto/create-packing-rule.dto';
import { UpdatePackingRuleDto } from './dto/update-packing-rule.dto';
import { PackingRule } from './entities/packing-rule.entity';
import { PackingRulesService } from './packing-rules.service';

@ApiTags('packing-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('packing-rules')
export class PackingRulesController {
  constructor(private readonly service: PackingRulesService) {}

  @Get()
  findAll(): Promise<PackingRule[]> {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreatePackingRuleDto): Promise<PackingRule> {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackingRuleDto,
  ): Promise<PackingRule> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
