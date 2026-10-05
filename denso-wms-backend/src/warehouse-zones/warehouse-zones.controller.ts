import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { WarehouseZonesService } from './warehouse-zones.service';

@ApiTags('warehouse-zones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('warehouse-zones')
export class WarehouseZonesController {
  constructor(private readonly service: WarehouseZonesService) {}
  @Get() list(@Query('warehouseCode') warehouseCode?: string) { return this.service.list(warehouseCode); }
  @Post() create(@Body() dto: CreateZoneDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateZoneDto) { return this.service.update(id, dto); }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
