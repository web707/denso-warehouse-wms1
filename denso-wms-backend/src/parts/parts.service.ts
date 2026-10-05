import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { HistoryEventType } from '../history/entities/history-event.entity';
import { Container } from '../containers/entities/container.entity';
import { HistoryService } from '../history/history.service';
import { nextPartColor } from './constants/part-colors';
import { AssignPartDto } from './dto/assign-part.dto';
import { AssignRackDto } from './dto/assign-rack.dto';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';
import { QueryPartsDto } from './dto/query-parts.dto';
import { Part } from './entities/part.entity';

function computeCbm(lengthMm: number, widthMm: number, heightMm: number, cartons: number): string {
  const cbm = (lengthMm * widthMm * heightMm * cartons) / 1_000_000_000;
  return cbm.toFixed(6);
}

@Injectable()
export class PartsService {
  constructor(
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Container) private readonly racks: Repository<Container>,
    private readonly history: HistoryService,
  ) {}

  findAll(query: QueryPartsDto): Promise<Part[]> {
    const where: FindOptionsWhere<Part> = {};
    if (query.orderId) where.orderId = query.orderId;
    if (query.containerId) where.containerId = query.containerId;
    return this.parts.find({ where, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Part> {
    const part = await this.parts.findOne({ where: { id } });
    if (!part)
      throw new NotFoundException({ code: 'PART_NOT_FOUND', message: 'Không tìm thấy PART' });
    return part;
  }

  async create(dto: CreatePartDto): Promise<Part> {
    const existingCount = await this.parts.count();
    const cbm = computeCbm(
      dto.cartonLengthMm,
      dto.cartonWidthMm,
      dto.cartonHeightMm,
      dto.cartonCount,
    );
    const part = await this.parts.save(
      this.parts.create({
        orderId: dto.orderId,
        partName: dto.partName,
        productCode: dto.productCode ?? null,
        divisionId: dto.divisionId,
        dcPrefixId: dto.dcPrefixId,
        masterPo: dto.masterPo,
        quantityPcs: dto.quantityPcs,
        totalWeightKg: dto.totalWeightKg.toString(),
        cartonCount: dto.cartonCount,
        cartonLengthMm: dto.cartonLengthMm,
        cartonWidthMm: dto.cartonWidthMm,
        cartonHeightMm: dto.cartonHeightMm,
        cbm,
        containerId: null,
        preferredRackSlot: null,
        colorHex: dto.colorHex ?? nextPartColor(existingCount),
      }),
    );
    await this.history.log(HistoryEventType.PART_ADDED, `Thêm PART ${part.partName}`, {
      partId: part.id,
    });
    return this.findOne(part.id);
  }

  async update(id: string, dto: UpdatePartDto): Promise<Part> {
    const part = await this.findOne(id);
    Object.assign(part, {
      ...dto,
      totalWeightKg:
        dto.totalWeightKg !== undefined ? dto.totalWeightKg.toString() : part.totalWeightKg,
    });
    const lengthMm = dto.cartonLengthMm ?? part.cartonLengthMm;
    const widthMm = dto.cartonWidthMm ?? part.cartonWidthMm;
    const heightMm = dto.cartonHeightMm ?? part.cartonHeightMm;
    const cartonCount = dto.cartonCount ?? part.cartonCount;
    part.cbm = computeCbm(lengthMm, widthMm, heightMm, cartonCount);
    await this.parts.save(part);
    await this.history.log(HistoryEventType.PART_UPDATED, `Cập nhật PART ${part.partName}`, {
      partId: part.id,
    });
    return this.findOne(id);
  }

  async assign(id: string, dto: AssignPartDto): Promise<Part> {
    const part = await this.findOne(id);
    part.containerId = dto.containerId ?? null;
    await this.parts.save(part);
    await this.history.log(
      HistoryEventType.PART_ASSIGNED,
      dto.containerId
        ? `Gán PART ${part.partName} vào kệ`
        : `Bỏ gán PART ${part.partName} khỏi kệ`,
      { partId: part.id, containerId: dto.containerId ?? null },
    );
    return this.findOne(id);
  }


  async assignRack(id: string, dto: AssignRackDto): Promise<Part> {
    const part = await this.findOne(id);
    const previousRackId = part.containerId;
    const previousSlotIndex = part.preferredRackSlot;

    if (dto.rackId && dto.slotIndex !== undefined && dto.slotIndex !== null) {
      const conflict = await this.parts.findOne({
        where: {
          containerId: dto.rackId,
          preferredRackSlot: dto.slotIndex,
          id: Not(id),
        },
      });
      if (conflict) {
        throw new NotFoundException({
          code: 'RACK_SLOT_OCCUPIED',
          message: `Ô S${String(dto.slotIndex + 1).padStart(2, '0')} đã được ưu tiên cho PART ${conflict.partName}`,
        });
      }
    }

    const [fromRack, toRack] = await Promise.all([
      previousRackId ? this.racks.findOne({ where: { id: previousRackId } }) : Promise.resolve(null),
      dto.rackId ? this.racks.findOne({ where: { id: dto.rackId } }) : Promise.resolve(null),
    ]);

    part.containerId = dto.rackId ?? null;
    part.preferredRackSlot = dto.rackId ? (dto.slotIndex ?? null) : null;
    await this.parts.save(part);

    const fromSlot = previousSlotIndex === null || previousSlotIndex === undefined
      ? null
      : `S${String(previousSlotIndex + 1).padStart(2, '0')}`;
    const toSlot = part.preferredRackSlot === null
      ? null
      : `S${String(part.preferredRackSlot + 1).padStart(2, '0')}`;

    const moved = Boolean(previousRackId && dto.rackId) &&
      (previousRackId !== dto.rackId || previousSlotIndex !== part.preferredRackSlot);

    const description = dto.rackId
      ? moved
        ? `Điều chuyển PART ${part.partName}: ${fromRack?.name || 'Kệ'}${fromSlot ? `-${fromSlot}` : ''} → ${toRack?.name || 'Kệ'}${toSlot ? `-${toSlot}` : ''}`
        : `Gán PART ${part.partName} vào ${toRack?.name || 'kệ'}${toSlot ? ` · ô ${toSlot}` : ''}`
      : `Bỏ gán PART ${part.partName} khỏi kệ`;

    await this.history.log(
      HistoryEventType.PART_ASSIGNED,
      description,
      {
        action: moved ? 'rack_move' : dto.rackId ? 'rack_assign' : 'rack_unassign',
        partId: part.id,
        partName: part.partName,
        productCode: part.productCode,
        orderId: part.orderId,
        fromRackId: previousRackId,
        fromRackName: fromRack?.name ?? null,
        fromSlotIndex: previousSlotIndex,
        fromSlot,
        toRackId: dto.rackId ?? null,
        toRackName: toRack?.name ?? null,
        toSlotIndex: part.preferredRackSlot,
        toSlot,
        totalWeightKg: Number(part.totalWeightKg),
        cartonCount: part.cartonCount,
      },
      part.orderId,
    );
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const part = await this.findOne(id);
    await this.parts.remove(part);
    await this.history.log(HistoryEventType.PART_DELETED, `Xoá PART ${part.partName}`, {
      partId: id,
    });
  }
}
