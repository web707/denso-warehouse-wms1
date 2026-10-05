import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult, paginate } from '../common/dto/pagination.dto';
import { HistoryEvent, HistoryEventType } from './entities/history-event.entity';

@Injectable()
export class HistoryService {
  constructor(@InjectRepository(HistoryEvent) private readonly events: Repository<HistoryEvent>) {}

  async log(
    type: HistoryEventType,
    description: string,
    details?: Record<string, unknown>,
    orderId?: string | null,
  ): Promise<HistoryEvent> {
    return this.events.save(
      this.events.create({
        type,
        description,
        details: details ?? null,
        orderId: orderId ?? null,
        timestamp: new Date(),
      }),
    );
  }

  async findAll(
    page: number,
    pageSize: number,
    type?: HistoryEventType,
    orderId?: string,
  ): Promise<PaginatedResult<HistoryEvent>> {
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (orderId) where.orderId = orderId;
    const [items, total] = await this.events.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return paginate(items, total, page, pageSize);
  }
}
