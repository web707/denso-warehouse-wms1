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
import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { Container } from './entities/container.entity';

function toRack(row: Container) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orderId: row.orderId,
    name: row.name,
    warehouseCode: row.warehouseCode,
    zoneCode: row.zoneCode,
    rackType: row.containerType
      ? {
          id: row.containerType.id,
          code: row.containerType.code,
          label: row.containerType.label,
          maxCbm: row.containerType.maxCbm,
          maxPayloadKg: row.containerType.maxPayloadKg,
          internalLengthMm: row.containerType.internalLengthMm,
          internalWidthMm: row.containerType.internalWidthMm,
          internalHeightMm: row.containerType.internalHeightMm,
        }
      : null,
    maxCbmOverride: row.maxCbmOverride,
    maxPayloadKgOverride: row.maxPayloadKgOverride,
  };
}

@ApiTags('racks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('racks')
export class ContainersController {
  constructor(private readonly service: ContainersService) {}

  @Get()
  async findAll(@Query('orderId') orderId?: string): Promise<any[]> {
    const rows = await this.service.findAll(orderId);
    return rows.map(toRack);
  }

  @Post('initialize-warehouse')
  async initializeWarehouse(
    @Body()
    body: {
      orderId: string;
      warehouseCode?: string;
      zoneCode?: string;
      rackCount?: number;
      rackTypeId?: string;
    },
  ): Promise<any> {
    const result = await this.service.initializeWarehouse(body);
    return {
      createdCount: result.createdCount,
      renamedCount: result.renamedCount,
      racks: result.racks.map(toRack),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return toRack(await this.service.findOne(id));
  }

  @Post()
  async create(
    @Body()
    body: {
      rackTypeId: string;
      orderId: string;
      name: string;
      warehouseCode?: string;
      zoneCode?: string;
      maxCbmOverride?: number;
      maxPayloadKgOverride?: number;
    },
  ): Promise<any> {
    const dto: CreateContainerDto = {
      containerTypeId: body.rackTypeId,
      orderId: body.orderId,
      name: body.name,
      warehouseCode: body.warehouseCode,
      zoneCode: body.zoneCode,
      maxCbmOverride: body.maxCbmOverride,
      maxPayloadKgOverride: body.maxPayloadKgOverride,
    };
    return toRack(await this.service.create(dto));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      rackTypeId?: string;
      orderId?: string;
      name?: string;
      warehouseCode?: string;
      zoneCode?: string;
      maxCbmOverride?: number;
      maxPayloadKgOverride?: number;
    },
  ): Promise<any> {
    const dto: UpdateContainerDto = {
      containerTypeId: body.rackTypeId,
      orderId: body.orderId,
      name: body.name,
      warehouseCode: body.warehouseCode,
      zoneCode: body.zoneCode,
      maxCbmOverride: body.maxCbmOverride,
      maxPayloadKgOverride: body.maxPayloadKgOverride,
    };
    return toRack(await this.service.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
