import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { QueryHeatmapDto } from './dto/query-heatmap.dto';
import { InventoryTransactionType } from './entities/inventory-transaction.entity';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('transactions')
  list(
    @Query('type') type?: InventoryTransactionType,
    @Query('orderId') orderId?: string,
    @Query('partId') partId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list({ type, orderId, partId, limit: limit ? Number(limit) : undefined });
  }

  @Post('transactions')
  create(@Body() dto: CreateInventoryTransactionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Get('heatmap')
  getHeatmap(@Query() query: QueryHeatmapDto) {
    return this.service.getHeatmap(query);
  }
}
