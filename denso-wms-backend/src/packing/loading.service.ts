import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Container } from '../containers/entities/container.entity';
import { ContainerType } from '../container-types/entities/container-type.entity';
import { HistoryEventType } from '../history/entities/history-event.entity';
import { HistoryService } from '../history/history.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { Part } from '../parts/entities/part.entity';
import { CartonPlacement } from './entities/carton-placement.entity';
import { LoadPlan } from './entities/load-plan.entity';
import { ContainerDims, ContainerRecommendation, SolverPart, Violation } from './domain/types';
import { solve } from './solver/solve';

@Injectable()
export class LoadingService {
  constructor(
    @InjectRepository(Container) private readonly containers: Repository<Container>,
    @InjectRepository(ContainerType) private readonly containerTypes: Repository<ContainerType>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(LoadPlan) private readonly loadPlans: Repository<LoadPlan>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly history: HistoryService,
  ) {}

  async solveContainer(containerId: string): Promise<LoadPlan> {
    const container = await this.containers.findOne({ where: { id: containerId } });
    if (!container) {
      throw new NotFoundException({
        code: 'CONTAINER_NOT_FOUND',
        message: 'Không tìm thấy kệ kho',
      });
    }
    const parts = await this.parts.find({ where: { containerId } });

    const dims: ContainerDims = {
      internalLengthMm: container.containerType.internalLengthMm,
      internalWidthMm: container.containerType.internalWidthMm,
      internalHeightMm: container.containerType.internalHeightMm,
      doorHeightMm: container.containerType.doorHeightMm,
      maxCbm: Number(container.maxCbmOverride ?? container.containerType.maxCbm),
      maxPayloadKg: Number(container.maxPayloadKgOverride ?? container.containerType.maxPayloadKg),
    };

    const solverParts: SolverPart[] = parts.map((p) => ({
      id: p.id,
      partName: p.partName,
      masterPo: p.masterPo,
      divisionSortOrder: p.division.sortOrder,
      dcPrefixSortOrder: p.dcPrefix.sortOrder,
      dcPrefixCode: p.dcPrefix.code,
      divisionCode: p.division.code,
      cartonCount: p.cartonCount,
      cartonLengthMm: p.cartonLengthMm,
      cartonWidthMm: p.cartonWidthMm,
      cartonHeightMm: p.cartonHeightMm,
      totalWeightKg: Number(p.totalWeightKg),
      preferredRackSlot: p.preferredRackSlot,
      colorHex: p.colorHex,
    }));

    const result = solve(solverParts, dims);

    const savedPlan = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(LoadPlan)
        .update({ containerId, isCurrent: true }, { isCurrent: false });

      const plan = await manager.getRepository(LoadPlan).save(
        manager.getRepository(LoadPlan).create({
          containerId,
          isCurrent: true,
          wallCount: result.wallCount,
          layerCount: result.layerCount,
          cbmUsed: result.cbmUsed.toFixed(6),
          weightUsedKg: result.weightUsedKg.toFixed(2),
          blocks: result.blocks,
          violations: result.violations,
        }),
      );

      if (result.placements.length > 0) {
        const placementRepo = manager.getRepository(CartonPlacement);
        const rows = result.placements.map((p) =>
          placementRepo.create({
            loadPlanId: plan.id,
            partId: p.partId,
            blockIndex: p.blockIndex,
            cartonSeq: p.cartonSeq,
            wallIndex: p.wallIndex,
            layer: p.layer,
            column: p.column,
            xMm: p.xMm,
            yMm: p.yMm,
            zMm: p.zMm,
            dxMm: p.dxMm,
            dyMm: p.dyMm,
            dzMm: p.dzMm,
            rotated: p.rotated,
            colorHex: p.colorHex,
          }),
        );
        await placementRepo.save(rows);
      }

      return plan;
    });

    await this.history.log(
      HistoryEventType.SOLVE,
      `Tính toán phân hàng cho kệ ${container.name}: ${result.placements.length} thùng, ${result.violations.length} cảnh báo`,
      { rackId: containerId, rackName: container.name, planId: savedPlan.id, violationCount: result.violations.length },
      container.orderId,
    );

    if (container.orderId) {
      await this.orders.update(
        { id: container.orderId, status: OrderStatus.DRAFT },
        { status: OrderStatus.ALLOCATED },
      );
    }

    return this.getPlan(containerId);
  }

  /**
   * Fills a freshly created (or partially filled) container with the
   * order's still-unassigned parts, in the same division -> DC prefix ->
   * master PO order the solver uses, so wall sequencing stays contiguous.
   * Stops at the first part that the real 3D block-split solver cannot place as
   * a complete prefix-fill, leaving the rest unassigned so the caller can
   * prompt for another container.
   */
  async autoAssign(
    containerId: string,
  ): Promise<{ assignedCount: number; remainingUnassignedCount: number }> {
    const container = await this.containers.findOne({ where: { id: containerId } });
    if (!container) {
      throw new NotFoundException({
        code: 'CONTAINER_NOT_FOUND',
        message: 'Không tìm thấy kệ kho',
      });
    }
    if (!container.orderId) {
      throw new BadRequestException({
        code: 'CONTAINER_HAS_NO_ORDER',
        message: 'Kệ chưa gắn với đơn hàng nào',
      });
    }

    const dims: ContainerDims = {
      internalLengthMm: container.containerType.internalLengthMm,
      internalWidthMm: container.containerType.internalWidthMm,
      internalHeightMm: container.containerType.internalHeightMm,
      doorHeightMm: container.containerType.doorHeightMm,
      maxCbm: Number(container.maxCbmOverride ?? container.containerType.maxCbm),
      maxPayloadKg: Number(container.maxPayloadKgOverride ?? container.containerType.maxPayloadKg),
    };

    const alreadyAssigned = await this.parts.find({ where: { containerId } });
    const candidates = await this.parts.find({
      where: { orderId: container.orderId, containerId: IsNull() },
    });
    // Same division -> DC prefix -> master PO ordering the solver uses
    // (see solver/ordering.ts::compareLoadingOrder) so a contiguous prefix
    // of this list matches how solve() will later sequence the walls.
    candidates.sort((a, b) => {
      if (a.division.sortOrder !== b.division.sortOrder) {
        return a.division.sortOrder - b.division.sortOrder;
      }
      if (a.dcPrefix.sortOrder !== b.dcPrefix.sortOrder) {
        return a.dcPrefix.sortOrder - b.dcPrefix.sortOrder;
      }
      const aPo = Number(a.masterPo);
      const bPo = Number(b.masterPo);
      if (Number.isFinite(aPo) && Number.isFinite(bPo) && aPo !== bPo) return aPo - bPo;
      return a.masterPo.localeCompare(b.masterPo);
    });

    const accepted: Part[] = [];
    for (const p of candidates) {
      const trialParts = [...alreadyAssigned, ...accepted, p].map((part) => ({
        id: part.id,
        partName: part.partName,
        masterPo: part.masterPo,
        divisionSortOrder: part.division.sortOrder,
        dcPrefixSortOrder: part.dcPrefix.sortOrder,
        dcPrefixCode: part.dcPrefix.code,
        divisionCode: part.division.code,
        cartonCount: part.cartonCount,
        cartonLengthMm: part.cartonLengthMm,
        cartonWidthMm: part.cartonWidthMm,
        cartonHeightMm: part.cartonHeightMm,
        totalWeightKg: Number(part.totalWeightKg),
        preferredRackSlot: part.preferredRackSlot,
        colorHex: part.colorHex,
      }));
      const result = solve(trialParts, dims);
      const placedCartonCount = result.blocks.reduce(
        (sum, block) => sum + block.placedCartonCount,
        0,
      );
      const expectedCartonCount = trialParts.reduce((sum, part) => sum + part.cartonCount, 0);
      const hasError = result.violations.some((violation) => violation.severity === 'error');
      if (placedCartonCount !== expectedCartonCount || hasError) break;
      accepted.push(p);
    }

    if (accepted.length > 0) {
      await this.parts.update({ id: In(accepted.map((p) => p.id)) }, { containerId });
      await this.history.log(
        HistoryEventType.PART_ASSIGNED,
        `Tự động phân bổ ${accepted.length} PART vào kệ ${container.name}`,
        {
          rackId: containerId,
          rackName: container.name,
          orderId: container.orderId,
          partIds: accepted.map((p) => p.id),
          partNames: accepted.map((p) => p.partName),
        },
        container.orderId,
      );
    }

    return {
      assignedCount: accepted.length,
      remainingUnassignedCount: candidates.length - accepted.length,
    };
  }

  /**
   * Recommends which container TYPE to use for an order's still-unassigned
   * parts (falling back to the whole order if everything is already
   * assigned) — computed by actually running the block-split solver against
   * every container type, not just a CBM/weight capacity check. A container
   * can have plenty of spare CBM and still fail to physically fit every
   * carton (division zones and block splits can still eat length faster
   * than volume alone would suggest), so CBM-only sizing is unreliable.
   * Candidates are ordered smallest-to-largest by maxCbm; the smallest one
   * that places every carton wins. If none fits everything, the candidate
   * that places the most cartons is returned as a best-effort suggestion
   * and `fullyFits` is false so the caller knows more containers are needed.
   */
  async recommendContainer(orderId: string): Promise<ContainerRecommendation> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng' });
    }

    let candidateParts = await this.parts.find({ where: { orderId, containerId: IsNull() } });
    if (candidateParts.length === 0) {
      candidateParts = await this.parts.find({ where: { orderId } });
    }
    if (candidateParts.length === 0) {
      throw new BadRequestException({
        code: 'ORDER_HAS_NO_PARTS',
        message: 'Đơn hàng chưa có PART nào để đề xuất kệ',
      });
    }

    const solverParts: SolverPart[] = candidateParts.map((p) => ({
      id: p.id,
      partName: p.partName,
      masterPo: p.masterPo,
      divisionSortOrder: p.division.sortOrder,
      dcPrefixSortOrder: p.dcPrefix.sortOrder,
      dcPrefixCode: p.dcPrefix.code,
      divisionCode: p.division.code,
      cartonCount: p.cartonCount,
      cartonLengthMm: p.cartonLengthMm,
      cartonWidthMm: p.cartonWidthMm,
      cartonHeightMm: p.cartonHeightMm,
      totalWeightKg: Number(p.totalWeightKg),
      preferredRackSlot: p.preferredRackSlot,
      colorHex: p.colorHex,
    }));
    const totalCartonCount = solverParts.reduce((s, p) => s + p.cartonCount, 0);

    const types = await this.containerTypes.find({ order: { maxCbm: 'ASC' } });
    const candidates = types.map((type) => {
      const dims: ContainerDims = {
        internalLengthMm: type.internalLengthMm,
        internalWidthMm: type.internalWidthMm,
        internalHeightMm: type.internalHeightMm,
        doorHeightMm: type.doorHeightMm,
        maxCbm: Number(type.maxCbm),
        maxPayloadKg: Number(type.maxPayloadKg),
      };
      const result = solve(solverParts, dims);
      const placedCartonCount = result.blocks.reduce((s, b) => s + b.placedCartonCount, 0);
      const errorCount = result.violations.filter((v) => v.severity === 'error').length;
      return {
        containerTypeId: type.id,
        code: type.code,
        label: type.label,
        maxCbm: dims.maxCbm,
        maxPayloadKg: dims.maxPayloadKg,
        cbmUsed: result.cbmUsed,
        weightUsedKg: result.weightUsedKg,
        cartonCount: totalCartonCount,
        placedCartonCount,
        fits: placedCartonCount === totalCartonCount && errorCount === 0,
        wallCount: result.wallCount,
        layerCount: result.layerCount,
        errorCount,
      };
    });

    const fitting = candidates.find((c) => c.fits);
    const bestEffort = [...candidates].sort(
      (a, b) => b.placedCartonCount - a.placedCartonCount || a.maxCbm - b.maxCbm,
    )[0];
    const recommended = fitting ?? bestEffort;

    return {
      orderId,
      cartonCount: totalCartonCount,
      candidates,
      recommendedContainerTypeId: recommended?.containerTypeId ?? null,
      fullyFits: !!fitting,
    };
  }

  async getPlan(containerId: string): Promise<LoadPlan> {
    const plan = await this.loadPlans.findOne({
      where: { containerId, isCurrent: true },
      relations: { placements: true },
    });
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Chưa có kế hoạch phân hàng cho kệ này — gọi solve trước',
      });
    }
    plan.placements.sort(
      (a, b) => a.wallIndex - b.wallIndex || a.layer - b.layer || a.column - b.column,
    );
    return plan;
  }

  async getViolations(containerId: string): Promise<Violation[]> {
    const plan = await this.getPlan(containerId);
    return plan.violations;
  }

  async getPlanWithParts(
    containerId: string,
  ): Promise<{ plan: LoadPlan; partsById: Map<string, Part> }> {
    const plan = await this.getPlan(containerId);
    const partIds = [...new Set(plan.placements.map((p) => p.partId))];
    const parts = partIds.length ? await this.parts.find({ where: { id: In(partIds) } }) : [];
    const partsById = new Map(parts.map((p) => [p.id, p]));
    return { plan, partsById };
  }

  /** Container + its order (+ the order's total container count) — feeds
   * the single-container export's header block (order name, container
   * type, how many containers this order has in total, etc). */
  async getExportMeta(
    containerId: string,
  ): Promise<{ container: Container; order: Order | null; totalContainers: number }> {
    const container = await this.containers.findOne({ where: { id: containerId } });
    if (!container) {
      throw new NotFoundException({
        code: 'CONTAINER_NOT_FOUND',
        message: 'Không tìm thấy kệ kho',
      });
    }
    const order = container.orderId
      ? await this.orders.findOne({ where: { id: container.orderId } })
      : null;
    const totalContainers = container.orderId
      ? await this.containers.count({ where: { orderId: container.orderId } })
      : 1;
    return { container, order, totalContainers };
  }

  async getOrder(orderId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng' });
    }
    return order;
  }

  getContainersForOrder(orderId: string): Promise<Container[]> {
    return this.containers.find({ where: { orderId }, order: { createdAt: 'ASC' } });
  }

  async markOrderExported(orderId: string): Promise<void> {
    await this.orders.update({ id: orderId }, { status: OrderStatus.EXPORTED });
  }

  /** Same as getPlanWithParts, but returns null instead of throwing when the
   * container has no plan yet (used by the order-level export, which skips
   * containers nobody has run solve() for). */
  async tryGetPlanWithParts(
    containerId: string,
  ): Promise<{ plan: LoadPlan; partsById: Map<string, Part> } | null> {
    try {
      return await this.getPlanWithParts(containerId);
    } catch {
      return null;
    }
  }
}
