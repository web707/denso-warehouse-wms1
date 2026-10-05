import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContainerReport, ExcelExporter } from '../export/excel.exporter';
import { HistoryEventType } from '../history/entities/history-event.entity';
import { HistoryService } from '../history/history.service';
import { LoadingService } from './loading.service';

function publicPlan(plan: any) {
  const { containerId, ...rest } = plan;
  return { ...rest, rackId: containerId };
}

@ApiTags('warehouse-storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class LoadingController {
  constructor(
    private readonly service: LoadingService,
    private readonly excelExporter: ExcelExporter,
    private readonly history: HistoryService,
  ) {}

  @Post('racks/:id/solve')
  async solve(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return publicPlan(await this.service.solveContainer(id));
  }

  @Post('racks/:id/auto-assign')
  autoAssign(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ assignedCount: number; remainingUnassignedCount: number }> {
    return this.service.autoAssign(id);
  }

  @Get('racks/:id/plan')
  async getPlan(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    return publicPlan(await this.service.getPlan(id));
  }

  @Get('racks/:id/violations')
  getViolations(@Param('id', ParseUUIDPipe) id: string): Promise<any[]> {
    return this.service.getViolations(id);
  }

  @Get('orders/:id/recommend-rack')
  async recommendRack(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
    const result = await this.service.recommendContainer(id);
    return {
      orderId: result.orderId,
      cartonCount: result.cartonCount,
      fullyFits: result.fullyFits,
      recommendedRackTypeId: result.recommendedContainerTypeId,
      candidates: result.candidates.map((c) => ({
        rackTypeId: c.containerTypeId,
        code: c.code,
        label: c.label,
        maxCbm: c.maxCbm,
        maxPayloadKg: c.maxPayloadKg,
        cbmUsed: c.cbmUsed,
        weightUsedKg: c.weightUsedKg,
        cartonCount: c.cartonCount,
        placedCartonCount: c.placedCartonCount,
        fits: c.fits,
        bayCount: c.wallCount,
        levelCount: c.layerCount,
        errorCount: c.errorCount,
      })),
    };
  }

  @Get('racks/:id/export.xlsx')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportXlsx(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { plan, partsById } = await this.service.getPlanWithParts(id);
    const meta = await this.service.getExportMeta(id);
    const buffer = await this.excelExporter.buildCoordinateSheet(plan, partsById, meta);

    await this.history.log(
      HistoryEventType.EXPORT,
      `Xuất Excel vị trí kệ ${meta.container.name}`,
      { rackId: id, planId: plan.id },
      meta.container.orderId,
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vi-tri-ke-${meta.container.name.replace(/\s+/g, '-')}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('orders/:id/export.xlsx')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportOrderXlsx(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const order = await this.service.getOrder(id);
    const racks = await this.service.getContainersForOrder(id);

    const reports: ContainerReport[] = [];
    for (const rack of racks) {
      const planWithParts = await this.service.tryGetPlanWithParts(rack.id);
      if (planWithParts) reports.push({ container: rack, ...planWithParts });
    }

    const buffer = await this.excelExporter.buildOrderReport(order, reports);
    await this.service.markOrderExported(id);

    await this.history.log(
      HistoryEventType.EXPORT,
      `Xuất báo cáo kho cho đơn hàng ${order.name}`,
      {
        orderId: id,
        orderName: order.name,
        racks: reports.map((r) => ({
          rackId: r.container.id,
          rackName: r.container.name,
          partCount: r.partsById.size,
          cartonCount: r.plan.placements.length,
        })),
        parts: reports.flatMap((r) =>
          [...r.partsById.values()].map((p) => ({
            partId: p.id,
            partName: p.partName,
            rackId: r.container.id,
            rackName: r.container.name,
            cartonCount: p.cartonCount,
          })),
        ),
      },
      id,
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bao-cao-kho-${order.name.replace(/\s+/g, '-')}.xlsx"`,
    );
    res.send(buffer);
  }
}
