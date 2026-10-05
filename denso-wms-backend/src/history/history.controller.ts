import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginatedResult, PaginationQueryDto } from '../common/dto/pagination.dto';
import { HistoryEvent, HistoryEventType } from './entities/history-event.entity';
import { HistoryService } from './history.service';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class HistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: HistoryEventType })
  @IsOptional()
  @IsEnum(HistoryEventType)
  type?: HistoryEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;
}

@ApiTags('history')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly service: HistoryService) {}

  @Get()
  findAll(@Query() query: HistoryQueryDto): Promise<PaginatedResult<HistoryEvent>> {
    return this.service.findAll(query.page, query.pageSize, query.type, query.orderId);
  }
}
