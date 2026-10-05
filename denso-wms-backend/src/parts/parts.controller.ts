import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssignRackDto } from './dto/assign-rack.dto';
import { CreatePartDto } from './dto/create-part.dto';
import { QueryPartsDto } from './dto/query-parts.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { Part } from './entities/part.entity';
import { PartsService } from './parts.service';

function toWarehousePart(p: Part) {
  return {
    id: p.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    orderId: p.orderId,
    partName: p.partName,
    productCode: p.productCode,
    division: p.division,
    dcPrefix: p.dcPrefix,
    masterPo: p.masterPo,
    quantityPcs: p.quantityPcs,
    totalWeightKg: p.totalWeightKg,
    cartonCount: p.cartonCount,
    cartonLengthMm: p.cartonLengthMm,
    cartonWidthMm: p.cartonWidthMm,
    cartonHeightMm: p.cartonHeightMm,
    cbm: p.cbm,
    rackId: p.containerId,
    preferredRackSlot: p.preferredRackSlot,
    colorHex: p.colorHex,
  };
}

@ApiTags('parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parts')
export class PartsController {
  constructor(private readonly service: PartsService) {}

  @Get()
  async findAll(@Query() query: QueryPartsDto): Promise<any[]> {
    const rows = await this.service.findAll(query);
    return rows.map(toWarehousePart);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return toWarehousePart(await this.service.findOne(id));
  }

  @Post()
  async create(@Body() dto: CreatePartDto): Promise<any> {
    return toWarehousePart(await this.service.create(dto));
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartDto): Promise<any> {
    return toWarehousePart(await this.service.update(id, dto));
  }

  @Patch(':id/rack-assignment')
  async assignRack(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRackDto): Promise<any> {
    return toWarehousePart(await this.service.assignRack(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
