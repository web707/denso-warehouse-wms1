import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Container } from '../containers/entities/container.entity';
import { Part } from '../parts/entities/part.entity';
import { CreateInventoryTransactionDto } from './dto/create-inventory-transaction.dto';
import { QueryHeatmapDto } from './dto/query-heatmap.dto';
import { InventoryTransaction, InventoryTransactionType } from './entities/inventory-transaction.entity';

function cbmFor(part: Part, cartons: number): string {
  return ((part.cartonLengthMm * part.cartonWidthMm * part.cartonHeightMm * cartons) / 1_000_000_000).toFixed(6);
}

function getHeatmapColor(score: number): {
  level: 'HOT' | 'WARM' | 'MODERATE' | 'COLD';
  color: string;
  velocityClass: 'A' | 'B' | 'C';
} {
  if (score > 80) return { level: 'HOT', color: '#ef4444', velocityClass: 'A' };
  if (score >= 60) return { level: 'WARM', color: '#f97316', velocityClass: 'A' };
  if (score >= 30) return { level: 'MODERATE', color: '#eab308', velocityClass: 'B' };
  return { level: 'COLD', color: '#3b82f6', velocityClass: 'C' };
}

function getSlotHeatColor(score: number): string {
  if (score > 80) return '#ef4444';
  if (score >= 60) return '#f97316';
  if (score >= 30) return '#eab308';
  return '#3b82f6';
}

export interface HeatmapRackItem {
  id: string;
  name: string;
  warehouseCode: string;
  zoneCode: string;
  orderId: string | null;
  operations: {
    total: number;
    inbound: number;
    outbound: number;
    transfer: number;
  };
  metrics: {
    totalPcs: number;
    totalCartons: number;
    totalWeightKg: number;
  };
  score: number;
  level: 'HOT' | 'WARM' | 'MODERATE' | 'COLD';
  color: string;
  velocityClass: 'A' | 'B' | 'C';
  slots: Record<number, { slotIndex: number; operations: number; score: number; color: string }>;
}

export interface HeatmapZoneItem {
  zoneCode: string;
  warehouseCode: string;
  rackCount: number;
  totalOperations: number;
  averageScore: number;
  hotRacksCount: number;
}

export interface HeatmapResponse {
  timeWindowDays: number;
  cutoffDate: string;
  summary: {
    totalTransactions: number;
    totalRackOperations: number;
    activeRacksCount: number;
    hotRacksCount: number;
    coldRacksCount: number;
    maxOperations: number;
    minOperations: number;
    hottestRack: { id: string; name: string; score: number; operations: number } | null;
    coldestRack: { id: string; name: string; score: number; operations: number } | null;
    paretoRatio: {
      top20PercentRacksTraffic: number;
      description: string;
    };
  };
  zones: Record<string, HeatmapZoneItem>;
  racks: Record<string, HeatmapRackItem>;
  rackList: HeatmapRackItem[];
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryTransaction) private readonly transactions: Repository<InventoryTransaction>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Container) private readonly racks: Repository<Container>,
  ) {}

  async list(params: { type?: InventoryTransactionType; orderId?: string; partId?: string; limit?: number }) {
    const where: FindOptionsWhere<InventoryTransaction> = {};
    if (params.type) where.type = params.type;
    if (params.orderId) where.orderId = params.orderId;
    if (params.partId) where.partId = params.partId;
    return this.transactions.find({
      where,
      order: { createdAt: 'DESC' },
      take: Math.max(1, Math.min(500, params.limit || 200)),
    });
  }

  private async ensureSlotAvailable(partId: string, rackId: string, slot: number | null | undefined) {
    const rack = await this.racks.findOne({ where: { id: rackId } });
    if (!rack) throw new NotFoundException({ code: 'RACK_NOT_FOUND', message: 'Không tìm thấy kệ đích' });
    if (slot === null || slot === undefined) return rack;
    const conflict = await this.parts.findOne({
      where: { containerId: rackId, preferredRackSlot: slot, id: Not(partId) },
    });
    if (conflict) {
      throw new BadRequestException({
        code: 'RACK_SLOT_OCCUPIED',
        message: `Ô S${String(slot + 1).padStart(2, '0')} đang được dùng bởi ${conflict.partName}`,
      });
    }
    return rack;
  }

  async create(dto: CreateInventoryTransactionDto, user: AuthenticatedUser): Promise<InventoryTransaction> {
    const part = await this.parts.findOne({ where: { id: dto.partId } });
    if (!part) throw new NotFoundException({ code: 'PART_NOT_FOUND', message: 'Không tìm thấy PART' });

    const fromRackId = part.containerId;
    const fromSlot = part.preferredRackSlot;
    const qty = Math.max(0, dto.quantityPcs || 0);
    const cartons = Math.max(0, dto.cartonCount || 0);
    const weight = Math.max(0, dto.weightKg || 0);

    if (dto.type === InventoryTransactionType.INBOUND) {
      if (qty === 0 && cartons === 0 && weight === 0) {
        throw new BadRequestException({ code: 'INBOUND_ZERO', message: 'Nhập kho phải có số lượng, số thùng hoặc khối lượng lớn hơn 0' });
      }
      if (dto.toRackId) {
        await this.ensureSlotAvailable(part.id, dto.toRackId, dto.toSlot);
        part.containerId = dto.toRackId;
        part.preferredRackSlot = dto.toSlot ?? null;
      }
      part.quantityPcs += qty;
      part.cartonCount += cartons;
      part.totalWeightKg = (Number(part.totalWeightKg) + weight).toFixed(2);
      part.cbm = cbmFor(part, part.cartonCount);
    } else if (dto.type === InventoryTransactionType.OUTBOUND) {
      if (qty === 0 && cartons === 0 && weight === 0) {
        throw new BadRequestException({ code: 'OUTBOUND_ZERO', message: 'Xuất kho phải có số lượng, số thùng hoặc khối lượng lớn hơn 0' });
      }
      if (qty > part.quantityPcs || cartons > part.cartonCount || weight > Number(part.totalWeightKg) + 0.001) {
        throw new BadRequestException({ code: 'OUTBOUND_EXCEEDS_STOCK', message: 'Số lượng xuất vượt tồn kho hiện tại' });
      }
      part.quantityPcs -= qty;
      part.cartonCount -= cartons;
      part.totalWeightKg = Math.max(0, Number(part.totalWeightKg) - weight).toFixed(2);
      part.cbm = cbmFor(part, part.cartonCount);
      if (part.cartonCount === 0 || part.quantityPcs === 0) {
        part.containerId = null;
        part.preferredRackSlot = null;
      }
    } else if (dto.type === InventoryTransactionType.TRANSFER) {
      if (!dto.toRackId) {
        throw new BadRequestException({ code: 'TRANSFER_RACK_REQUIRED', message: 'Điều chuyển cần chọn kệ đích' });
      }
      await this.ensureSlotAvailable(part.id, dto.toRackId, dto.toSlot);
      part.containerId = dto.toRackId;
      part.preferredRackSlot = dto.toSlot ?? null;
    }

    await this.parts.save(part);
    const tx = await this.transactions.save(this.transactions.create({
      type: dto.type,
      partId: part.id,
      partName: part.partName,
      productCode: part.productCode,
      orderId: part.orderId,
      fromRackId,
      fromSlot,
      toRackId: part.containerId,
      toSlot: part.preferredRackSlot,
      quantityPcs: qty,
      cartonCount: cartons,
      weightKg: weight.toFixed(2),
      note: dto.note?.trim() || null,
      performedBy: user?.id || null,
      performedByEmail: user?.email || null,
    }));
    return tx;
  }

  async getHeatmap(dto: QueryHeatmapDto = {}): Promise<HeatmapResponse> {
    const days = Math.max(1, Math.min(365, dto.days || 90));
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const warehouseCode = (dto.warehouseCode || 'DENSO-WH').trim();
    const zoneCode = dto.zoneCode?.trim();
    const orderId = dto.orderId?.trim();

    // 1. Lấy danh sách kệ mục tiêu
    const rackWhere: FindOptionsWhere<Container> = { warehouseCode };
    if (zoneCode) rackWhere.zoneCode = zoneCode;
    if (orderId) rackWhere.orderId = orderId;

    let targetRacks = await this.racks.find({
      where: rackWhere,
      order: { name: 'ASC' },
    });

    if (targetRacks.length === 0) {
      const fallbackWhere: FindOptionsWhere<Container> = { warehouseCode };
      if (zoneCode) fallbackWhere.zoneCode = zoneCode;
      targetRacks = await this.racks.find({
        where: fallbackWhere,
        order: { name: 'ASC' },
      });
    }

    // 2. Query thống kê tổng hợp thao tác trên từng kệ
    const queryParams: any[] = [cutoffDate];
    let orderFilterSql = '';
    if (orderId) {
      queryParams.push(orderId);
      orderFilterSql = `AND order_id = $${queryParams.length}`;
    }

    const rackStatsRaw: Array<{
      rack_id: string;
      total_ops: string;
      inbound_ops: string;
      outbound_ops: string;
      transfer_ops: string;
      total_pcs: string;
      total_cartons: string;
      total_weight: string;
    }> = await this.transactions.query(
      `
      SELECT
        ops.rack_id,
        COUNT(*)::int AS total_ops,
        SUM(CASE WHEN ops.op_type = 'inbound' THEN 1 ELSE 0 END)::int AS inbound_ops,
        SUM(CASE WHEN ops.op_type = 'outbound' THEN 1 ELSE 0 END)::int AS outbound_ops,
        SUM(CASE WHEN ops.op_type = 'transfer' THEN 1 ELSE 0 END)::int AS transfer_ops,
        COALESCE(SUM(ops.quantity_pcs), 0)::int AS total_pcs,
        COALESCE(SUM(ops.carton_count), 0)::int AS total_cartons,
        COALESCE(SUM(ops.weight_kg), 0)::numeric AS total_weight
      FROM (
        SELECT
          to_rack_id AS rack_id,
          'inbound' AS op_type,
          quantity_pcs,
          carton_count,
          COALESCE(weight_kg, 0) AS weight_kg
        FROM inventory_transactions
        WHERE to_rack_id IS NOT NULL
          AND type = 'inbound'
          AND created_at >= $1
          ${orderFilterSql}

        UNION ALL

        SELECT
          from_rack_id AS rack_id,
          'outbound' AS op_type,
          quantity_pcs,
          carton_count,
          COALESCE(weight_kg, 0) AS weight_kg
        FROM inventory_transactions
        WHERE from_rack_id IS NOT NULL
          AND type = 'outbound'
          AND created_at >= $1
          ${orderFilterSql}

        UNION ALL

        SELECT
          from_rack_id AS rack_id,
          'transfer' AS op_type,
          quantity_pcs,
          carton_count,
          COALESCE(weight_kg, 0) AS weight_kg
        FROM inventory_transactions
        WHERE from_rack_id IS NOT NULL
          AND type = 'transfer'
          AND created_at >= $1
          ${orderFilterSql}

        UNION ALL

        SELECT
          to_rack_id AS rack_id,
          'transfer' AS op_type,
          quantity_pcs,
          carton_count,
          COALESCE(weight_kg, 0) AS weight_kg
        FROM inventory_transactions
        WHERE to_rack_id IS NOT NULL
          AND type = 'transfer'
          AND created_at >= $1
          ${orderFilterSql}
      ) ops
      GROUP BY ops.rack_id
      `,
      queryParams,
    );

    // 3. Query thống kê từng ô (slot) trong mỗi kệ
    const slotStatsRaw: Array<{
      rack_id: string;
      slot: number;
      op_count: string;
    }> = await this.transactions.query(
      `
      SELECT
        slot_ops.rack_id,
        slot_ops.slot,
        COUNT(*)::int AS op_count
      FROM (
        SELECT to_rack_id AS rack_id, to_slot AS slot
        FROM inventory_transactions
        WHERE to_rack_id IS NOT NULL AND to_slot IS NOT NULL AND created_at >= $1 ${orderFilterSql}
        UNION ALL
        SELECT from_rack_id AS rack_id, from_slot AS slot
        FROM inventory_transactions
        WHERE from_rack_id IS NOT NULL AND from_slot IS NOT NULL AND type IN ('outbound', 'transfer') AND created_at >= $1 ${orderFilterSql}
      ) slot_ops
      GROUP BY slot_ops.rack_id, slot_ops.slot
      `,
      queryParams,
    );

    const statsMap = new Map<string, (typeof rackStatsRaw)[0]>();
    for (const r of rackStatsRaw) {
      if (r.rack_id) statsMap.set(r.rack_id, r);
    }

    const slotMap = new Map<string, Map<number, number>>();
    for (const s of slotStatsRaw) {
      if (!s.rack_id || s.slot === null || s.slot === undefined) continue;
      if (!slotMap.has(s.rack_id)) slotMap.set(s.rack_id, new Map());
      slotMap.get(s.rack_id)!.set(Number(s.slot), Number(s.op_count));
    }

    // 4. Chuẩn hóa điểm số (Score normalization 0 - 100)
    let maxOps = 0;
    let minOps = Number.MAX_SAFE_INTEGER;
    let totalRackOps = 0;

    for (const rack of targetRacks) {
      const stat = statsMap.get(rack.id);
      const ops = stat ? Number(stat.total_ops) : 0;
      totalRackOps += ops;
      if (ops > maxOps) maxOps = ops;
      if (ops < minOps) minOps = ops;
    }
    if (minOps === Number.MAX_SAFE_INTEGER) minOps = 0;

    const rackItems: HeatmapRackItem[] = [];
    const rackDict: Record<string, HeatmapRackItem> = {};
    const zoneAggregates: Record<
      string,
      { totalOps: number; scores: number[]; rackCount: number; hotCount: number }
    > = {};

    for (const rack of targetRacks) {
      const stat = statsMap.get(rack.id);
      const total = stat ? Number(stat.total_ops) : 0;
      const inbound = stat ? Number(stat.inbound_ops) : 0;
      const outbound = stat ? Number(stat.outbound_ops) : 0;
      const transfer = stat ? Number(stat.transfer_ops) : 0;
      const totalPcs = stat ? Number(stat.total_pcs) : 0;
      const totalCartons = stat ? Number(stat.total_cartons) : 0;
      const totalWeightKg = stat ? Number(stat.total_weight) : 0;

      // Điểm số chuẩn hóa 0..100 theo maxOps (tần suất tương đối)
      const score = maxOps > 0 ? Math.round((total / maxOps) * 100) : 0;
      const meta = getHeatmapColor(score);

      // Thống kê 20 ô của kệ
      const rackSlotCounts = slotMap.get(rack.id) || new Map<number, number>();
      let maxSlotOps = 0;
      for (let s = 0; s < 20; s++) {
        const c = rackSlotCounts.get(s) || 0;
        if (c > maxSlotOps) maxSlotOps = c;
      }

      const slots: Record<number, { slotIndex: number; operations: number; score: number; color: string }> = {};
      for (let s = 0; s < 20; s++) {
        const c = rackSlotCounts.get(s) || 0;
        const slotScore = maxSlotOps > 0 ? Math.round((c / maxSlotOps) * 100) : 0;
        slots[s] = {
          slotIndex: s,
          operations: c,
          score: slotScore,
          color: getSlotHeatColor(slotScore),
        };
      }

      const item: HeatmapRackItem = {
        id: rack.id,
        name: rack.name,
        warehouseCode: rack.warehouseCode,
        zoneCode: rack.zoneCode,
        orderId: rack.orderId,
        operations: { total, inbound, outbound, transfer },
        metrics: { totalPcs, totalCartons, totalWeightKg },
        score,
        level: meta.level,
        color: meta.color,
        velocityClass: meta.velocityClass,
        slots,
      };

      rackItems.push(item);
      rackDict[rack.id] = item;
      rackDict[rack.name] = item; // Alias cho việc tra cứu nhanh qua name trong 3D Scene

      // Gom nhóm theo zone
      const zCode = rack.zoneCode || 'ZONE-A';
      if (!zoneAggregates[zCode]) {
        zoneAggregates[zCode] = { totalOps: 0, scores: [], rackCount: 0, hotCount: 0 };
      }
      zoneAggregates[zCode].totalOps += total;
      zoneAggregates[zCode].scores.push(score);
      zoneAggregates[zCode].rackCount += 1;
      if (score > 80) zoneAggregates[zCode].hotCount += 1;
    }

    // Sắp xếp danh sách kệ theo điểm số giảm dần
    rackItems.sort((a, b) => b.score - a.score);

    // Tính toán tỉ lệ Pareto (Top 20% kệ chiếm bao nhiêu % tổng hoạt động)
    const top20Count = Math.max(1, Math.round(rackItems.length * 0.2));
    const top20Ops = rackItems.slice(0, top20Count).reduce((acc, cur) => acc + cur.operations.total, 0);
    const paretoPercent = totalRackOps > 0 ? Number(((top20Ops / totalRackOps) * 100).toFixed(1)) : 0;

    // Tổng hợp thông tin zones
    const zones: Record<string, HeatmapZoneItem> = {};
    for (const [zCode, val] of Object.entries(zoneAggregates)) {
      const avgScore =
        val.scores.length > 0 ? Math.round(val.scores.reduce((a, b) => a + b, 0) / val.scores.length) : 0;
      zones[zCode] = {
        zoneCode: zCode,
        warehouseCode,
        rackCount: val.rackCount,
        totalOperations: val.totalOps,
        averageScore: avgScore,
        hotRacksCount: val.hotCount,
      };
    }

    const totalTx = await this.transactions.count({
      where: {
        createdAt: MoreThanOrEqual(cutoffDate),
        ...(orderId ? { orderId } : {}),
      },
    });

    const hottest = rackItems[0]
      ? {
          id: rackItems[0].id,
          name: rackItems[0].name,
          score: rackItems[0].score,
          operations: rackItems[0].operations.total,
        }
      : null;
    const coldest = rackItems[rackItems.length - 1]
      ? {
          id: rackItems[rackItems.length - 1].id,
          name: rackItems[rackItems.length - 1].name,
          score: rackItems[rackItems.length - 1].score,
          operations: rackItems[rackItems.length - 1].operations.total,
        }
      : null;

    return {
      timeWindowDays: days,
      cutoffDate: cutoffDate.toISOString(),
      summary: {
        totalTransactions: totalTx,
        totalRackOperations: totalRackOps,
        activeRacksCount: rackItems.length,
        hotRacksCount: rackItems.filter((r) => r.score > 80).length,
        coldRacksCount: rackItems.filter((r) => r.score < 30).length,
        maxOperations: maxOps,
        minOperations: minOps,
        hottestRack: hottest,
        coldestRack: coldest,
        paretoRatio: {
          top20PercentRacksTraffic: paretoPercent,
          description: `Top ${top20Count} kệ (${paretoPercent}%) nắm giữ đại đa số lượt luân chuyển`,
        },
      },
      zones,
      racks: rackDict,
      rackList: rackItems,
    };
  }
}
