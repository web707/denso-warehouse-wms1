import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateShipmentDto, QueryShipmentsDto, UpdateShipmentDto } from './dto/create-shipment.dto';
import { Shipment } from './entities/shipment.entity';

const DAY_MS = 86_400_000;

/**
 * DelayDays: số ngày trễ so với ngày yêu cầu giao.
 * - Đã giao: ngày giao thực tế − ngày yêu cầu.
 * - Chưa giao (RELEASED): hôm nay − ngày yêu cầu (đang trễ tới hiện tại).
 * Không bao giờ âm; null nếu thiếu ngày yêu cầu.
 */
export function computeDelayDays(
  s: Pick<Shipment, 'requestedShipDate' | 'actualShipDate' | 'shipmentStatus'>,
  now = new Date(),
): number | null {
  if (!s.requestedShipDate) return null;
  const ref = s.actualShipDate ?? (s.shipmentStatus === 'RELEASED' ? now : null);
  if (!ref) return null;
  return Math.max(0, Math.floor((ref.getTime() - s.requestedShipDate.getTime()) / DAY_MS));
}

@Injectable()
export class ShipmentsService {
  constructor(@InjectRepository(Shipment) private readonly repo: Repository<Shipment>) {}

  async findAll(q: QueryShipmentsDto): Promise<Shipment[]> {
    const base: Record<string, unknown> = {};
    if (q.status) base.shipmentStatus = q.status;
    if (q.lotNumber) base.lotNumber = q.lotNumber;
    const where = q.search
      ? ['shipmentNumber', 'customerName', 'itemNumber', 'lotNumber', 'trackingNumber', 'sourceOrderNumber'].map((f) => ({
          ...base,
          [f]: ILike(`%${q.search}%`),
        }))
      : base;
    return this.repo.find({ where, order: { requestedShipDate: { direction: 'DESC', nulls: 'LAST' }, createdAt: 'DESC' }, take: 1000 });
  }

  async findOne(id: string): Promise<Shipment> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'SHIPMENT_NOT_FOUND', message: 'Không tìm thấy lô giao hàng' });
    return row;
  }

  async create(dto: CreateShipmentDto): Promise<Shipment> {
    if (await this.repo.findOne({ where: { shipmentNumber: dto.shipmentNumber } }))
      throw new ConflictException({ code: 'SHIPMENT_DUPLICATE', message: `Lô giao ${dto.shipmentNumber} đã tồn tại` });
    const entity = this.repo.create(this.normalise(dto) as Partial<Shipment>);
    this.applyStatusRules(entity);
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateShipmentDto): Promise<Shipment> {
    const row = await this.findOne(id);
    if (dto.shipmentNumber && dto.shipmentNumber !== row.shipmentNumber) {
      if (await this.repo.findOne({ where: { shipmentNumber: dto.shipmentNumber } }))
        throw new ConflictException({ code: 'SHIPMENT_DUPLICATE', message: `Lô giao ${dto.shipmentNumber} đã tồn tại` });
    }
    Object.assign(row, this.normalise(dto));
    this.applyStatusRules(row);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(await this.findOne(id));
  }

  private normalise(dto: object): Record<string, unknown> {
    const out: Record<string, unknown> = { ...dto };
    for (const f of ['requestedShipDate', 'actualShipDate']) {
      if (f in out) out[f] = out[f] ? new Date(out[f] as string) : null;
    }
    return out;
  }

  private applyStatusRules(s: Shipment): void {
    if ((s.shipmentStatus === 'SHIPPED' || s.shipmentStatus === 'DELIVERED') && !s.actualShipDate) s.actualShipDate = new Date();
    if (s.shipmentStatus === 'RELEASED' && s.actualShipDate) {
      throw new BadRequestException({
        code: 'SHIPMENT_STATUS_CONFLICT',
        message: 'Lô đã có ngày giao thực tế thì trạng thái phải là SHIPPED hoặc DELIVERED',
      });
    }
  }
}
