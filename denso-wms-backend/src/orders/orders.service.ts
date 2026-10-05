import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistoryEventType } from '../history/entities/history-event.entity';
import { HistoryService } from '../history/history.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly history: HistoryService,
  ) {}

  findAll(): Promise<Order[]> {
    return this.orders.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Không tìm thấy đơn hàng' });
    return order;
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    const order = await this.orders.save(
      this.orders.create({
        ...dto,
        name: dto.name || dto.orderNumber,
        destination: dto.destination ?? 'USA',
      }),
    );
    await this.history.log(
      HistoryEventType.ORDER_CREATED,
      `Tạo đơn hàng ${order.orderNumber}`,
      { orderId: order.id },
      order.id,
    );
    return order;
  }

  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    Object.assign(order, dto);
    const saved = await this.orders.save(order);
    await this.history.log(
      HistoryEventType.ORDER_UPDATED,
      `Cập nhật đơn hàng ${saved.orderNumber}`,
      { orderId: saved.id },
      saved.id,
    );
    return saved;
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);
    await this.orders.remove(order); // cascades to parts (onDelete: CASCADE)
    await this.history.log(
      HistoryEventType.ORDER_DELETED,
      `Xoá đơn hàng ${order.orderNumber}`,
      { orderId: id },
      id,
    );
  }
}
