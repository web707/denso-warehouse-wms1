import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../containers/entities/container.entity';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { WarehouseZone } from './entities/warehouse-zone.entity';

@Injectable()
export class WarehouseZonesService {
  constructor(
    @InjectRepository(WarehouseZone) private readonly zones: Repository<WarehouseZone>,
    @InjectRepository(Container) private readonly racks: Repository<Container>,
  ) {}

  list(warehouseCode?: string) {
    return this.zones.find({ where: warehouseCode ? { warehouseCode } : {}, order: { code: 'ASC' } });
  }

  async create(dto: CreateZoneDto) {
    const code = dto.code.trim().toUpperCase();
    const warehouseCode = dto.warehouseCode.trim().toUpperCase();
    const exists = await this.zones.findOne({ where: { code, warehouseCode } });
    if (exists) throw new BadRequestException({ code: 'ZONE_EXISTS', message: `${code} đã tồn tại` });
    return this.zones.save(this.zones.create({ ...dto, code, warehouseCode, description: dto.description || null, active: dto.active ?? true }));
  }

  async update(id: string, dto: UpdateZoneDto) {
    const zone = await this.zones.findOne({ where: { id } });
    if (!zone) throw new NotFoundException({ code: 'ZONE_NOT_FOUND', message: 'Không tìm thấy Zone' });
    const oldCode = zone.code;
    const oldWarehouse = zone.warehouseCode;
    if (dto.code) zone.code = dto.code.trim().toUpperCase();
    if (dto.warehouseCode) zone.warehouseCode = dto.warehouseCode.trim().toUpperCase();
    if (dto.name !== undefined) zone.name = dto.name;
    if (dto.description !== undefined) zone.description = dto.description || null;
    if (dto.active !== undefined) zone.active = dto.active;
    const saved = await this.zones.save(zone);
    if (oldCode !== zone.code || oldWarehouse !== zone.warehouseCode) {
      await this.racks.update({ warehouseCode: oldWarehouse, zoneCode: oldCode }, { warehouseCode: zone.warehouseCode, zoneCode: zone.code });
    }
    return saved;
  }

  async remove(id: string) {
    const zone = await this.zones.findOne({ where: { id } });
    if (!zone) return;
    const rackCount = await this.racks.count({ where: { warehouseCode: zone.warehouseCode, zoneCode: zone.code } });
    if (rackCount > 0) throw new BadRequestException({ code: 'ZONE_HAS_RACKS', message: `Zone còn ${rackCount} kệ. Hãy chuyển kệ sang Zone khác trước.` });
    await this.zones.remove(zone);
  }
}
