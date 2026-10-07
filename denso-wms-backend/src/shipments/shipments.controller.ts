import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateShipmentDto, QueryShipmentsDto, UpdateShipmentDto } from './dto/create-shipment.dto';
import { Shipment } from './entities/shipment.entity';
import { ShipmentsService, computeDelayDays } from './shipments.service';
import { OracleShipmentDto } from './oracle/oracle-shipment.dto';
import { fromOracleShipment, toOracleShipment } from './oracle/oracle-shipment.mapper';
import { EdiStandard, buildEdi } from './edi/edi.builder';

const withDelay = (s: Shipment) => ({ ...s, delayDays: computeDelayDays(s) });

@ApiTags('shipments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly service: ShipmentsService) {}

  @Get()
  async findAll(@Query() query: QueryShipmentsDto) {
    return (await this.service.findAll(query)).map(withDelay);
  }

  /** Danh sách theo định dạng JSON của Oracle Fusion Shipping (16 trường trong tài liệu Khâu 5). */
  @Get('oracle')
  async findAllOracle(@Query() query: QueryShipmentsDto) {
    const rows = await this.service.findAll(query);
    const items = rows.map((s) => toOracleShipment(s, computeDelayDays(s)));
    return { items, count: items.length, hasMore: false, limit: items.length, offset: 0 };
  }

  /** Nhận một lô giao theo định dạng Oracle (tên trường PascalCase). ShipmentId và DelayDays được bỏ qua. */
  @Post('oracle')
  async createOracle(@Body() dto: OracleShipmentDto) {
    const created = await this.service.create(fromOracleShipment(dto));
    return toOracleShipment(created, computeDelayDays(created));
  }

  @Get(':id/oracle')
  async findOneOracle(@Param('id', ParseUUIDPipe) id: string) {
    const s = await this.service.findOne(id);
    return toOracleShipment(s, computeDelayDays(s));
  }

  /** Thông báo giao hàng điện tử cho khách: ?standard=x12 (ASN 856, mặc định) hoặc edifact (DESADV D.96A). */
  @Get(':id/edi')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async edi(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('standard') standard = 'x12',
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    if (standard !== 'x12' && standard !== 'edifact') {
      throw new BadRequestException({ code: 'EDI_STANDARD', message: 'standard chỉ nhận x12 hoặc edifact' });
    }
    const s = await this.service.findOne(id);
    const text = buildEdi(standard as EdiStandard, s, {
      senderId: process.env.EDI_SENDER_ID,
      usage: process.env.EDI_USAGE === 'P' ? 'P' : 'T',
    });
    const ext = standard === 'edifact' ? 'edi' : 'x12';
    res.setHeader('Content-Disposition', `attachment; filename="${s.shipmentNumber}-${standard === 'edifact' ? 'DESADV' : '856'}.${ext}"`);
    return text;
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return withDelay(await this.service.findOne(id));
  }

  @Post()
  async create(@Body() dto: CreateShipmentDto) {
    return withDelay(await this.service.create(dto));
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShipmentDto) {
    return withDelay(await this.service.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }
}
