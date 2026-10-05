import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContainerType } from '../container-types/entities/container-type.entity';
import { HistoryEventType } from '../history/entities/history-event.entity';
import { HistoryService } from '../history/history.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { Container } from './entities/container.entity';

@Injectable()
export class ContainersService {
  constructor(
    @InjectRepository(Container) private readonly containers: Repository<Container>,
    @InjectRepository(ContainerType) private readonly containerTypes: Repository<ContainerType>,
    private readonly history: HistoryService,
  ) {}

  findAll(orderId?: string): Promise<Container[]> {
    return this.containers.find({
      where: orderId ? { orderId } : {},
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Container> {
    const container = await this.containers.findOne({ where: { id } });
    if (!container) {
      throw new NotFoundException({
        code: 'CONTAINER_NOT_FOUND',
        message: 'Không tìm thấy kệ kho',
      });
    }
    return container;
  }

  async create(dto: CreateContainerDto): Promise<Container> {
    const type = await this.containerTypes.findOne({ where: { id: dto.containerTypeId } });
    if (!type) {
      throw new NotFoundException({
        code: 'CONTAINER_TYPE_NOT_FOUND',
        message: 'Không tìm thấy loại kệ',
      });
    }
    const container = await this.containers.save(
      this.containers.create({
        containerTypeId: dto.containerTypeId,
        orderId: dto.orderId,
        name: dto.name,
        warehouseCode: dto.warehouseCode ?? 'DENSO-WH',
        zoneCode: dto.zoneCode ?? 'ZONE-A',
        maxCbmOverride: dto.maxCbmOverride?.toString() ?? null,
        maxPayloadKgOverride: dto.maxPayloadKgOverride?.toString() ?? null,
      }),
    );
    await this.history.log(
      HistoryEventType.CONTAINER_CREATED,
      `Tạo kệ ${container.name}`,
      { rackId: container.id, rackName: container.name },
      container.orderId,
    );
    return this.findOne(container.id);
  }

  async update(id: string, dto: UpdateContainerDto): Promise<Container> {
    const container = await this.findOne(id);
    if (dto.containerTypeId) container.containerTypeId = dto.containerTypeId;
    if (dto.orderId !== undefined) container.orderId = dto.orderId;
    if (dto.name !== undefined) container.name = dto.name;
    if (dto.warehouseCode !== undefined) container.warehouseCode = dto.warehouseCode;
    if (dto.zoneCode !== undefined) container.zoneCode = dto.zoneCode;
    if (dto.maxCbmOverride !== undefined) container.maxCbmOverride = dto.maxCbmOverride.toString();
    if (dto.maxPayloadKgOverride !== undefined) {
      container.maxPayloadKgOverride = dto.maxPayloadKgOverride.toString();
    }
    await this.containers.save(container);
    await this.history.log(
      HistoryEventType.CONTAINER_UPDATED,
      `Cập nhật kệ ${container.name}`,
      { rackId: container.id, rackName: container.name },
      container.orderId,
    );
    return this.findOne(id);
  }

  async initializeWarehouse(params: {
    orderId: string;
    warehouseCode?: string;
    zoneCode?: string;
    rackCount?: number;
    rackTypeId?: string;
  }): Promise<{ racks: Container[]; createdCount: number; renamedCount: number }> {
    if (!params.orderId) {
      throw new BadRequestException({
        code: 'WAREHOUSE_ORDER_REQUIRED',
        message: 'Cần có lô linh kiện gốc để giữ tương thích dữ liệu khi khởi tạo 20 kệ',
      });
    }
    const warehouseCode = (params.warehouseCode || 'DENSO-WH').trim() || 'DENSO-WH';
    const zoneCode = (params.zoneCode || 'ZONE-A').trim() || 'ZONE-A';
    const rackCount = Math.max(1, Math.min(50, Math.trunc(params.rackCount || 20)));

    let existing = await this.containers.find({
      where: { orderId: params.orderId, warehouseCode, zoneCode },
      order: { createdAt: 'ASC' },
    });

    let type: ContainerType | null = null;
    if (params.rackTypeId) {
      type = await this.containerTypes.findOne({ where: { id: params.rackTypeId } });
    } else if (existing[0]?.containerTypeId) {
      type = await this.containerTypes.findOne({ where: { id: existing[0].containerTypeId } });
    } else {
      type = await this.containerTypes.findOne({ where: { code: 'RACK20-A' } });
      if (!type) {
        const fallback = await this.containerTypes.find({ order: { createdAt: 'ASC' }, take: 1 });
        type = fallback[0] ?? null;
      }
    }

    if (!type) {
      throw new NotFoundException({
        code: 'RACK_TYPE_NOT_FOUND',
        message: 'Không tìm thấy cấu hình kệ 20 ô để khởi tạo kho',
      });
    }

    let renamedCount = 0;
    for (let i = 0; i < Math.min(existing.length, rackCount); i += 1) {
      const wantedName = `R${String(i + 1).padStart(2, '0')}`;
      const row = existing[i];
      let changed = false;
      if (row.name !== wantedName) {
        row.name = wantedName;
        renamedCount += 1;
        changed = true;
      }
      if (row.warehouseCode !== warehouseCode) { row.warehouseCode = warehouseCode; changed = true; }
      if (row.zoneCode !== zoneCode) { row.zoneCode = zoneCode; changed = true; }
      if (changed) await this.containers.save(row);
    }

    const missing = Math.max(0, rackCount - existing.length);
    if (missing > 0) {
      const rows = Array.from({ length: missing }, (_, idx) => {
        const number = existing.length + idx + 1;
        return this.containers.create({
          containerTypeId: type!.id,
          orderId: params.orderId,
          name: `R${String(number).padStart(2, '0')}`,
          warehouseCode,
          zoneCode,
          maxCbmOverride: null,
          maxPayloadKgOverride: null,
        });
      });
      await this.containers.save(rows);
    }

    existing = await this.containers.find({
      where: { orderId: params.orderId, warehouseCode, zoneCode },
      order: { createdAt: 'ASC' },
    });

    await this.history.log(
      HistoryEventType.CONTAINER_CREATED,
      `Khởi tạo sơ đồ kho ${warehouseCode}/${zoneCode}: ${Math.min(existing.length, rackCount)} kệ`,
      {
        warehouseCode,
        zoneCode,
        rackCount: Math.min(existing.length, rackCount),
        createdCount: missing,
        rackIds: existing.slice(0, rackCount).map((r) => r.id),
      },
      params.orderId,
    );

    return { racks: existing.slice(0, rackCount), createdCount: missing, renamedCount };
  }

  async remove(id: string): Promise<void> {
    const container = await this.findOne(id);
    await this.containers.remove(container); // parts.containerId set to NULL (ON DELETE SET NULL)
    await this.history.log(
      HistoryEventType.CONTAINER_DELETED,
      `Xoá kệ ${container.name}`,
      { rackId: id, rackName: container.name },
      container.orderId,
    );
  }
}
