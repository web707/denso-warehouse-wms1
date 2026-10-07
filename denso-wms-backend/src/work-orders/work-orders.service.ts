import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateWorkOrderDto, QueryWorkOrdersDto, UpdateWorkOrderDto } from './dto/create-work-order.dto';
import { WorkOrder } from './entities/work-order.entity';

const DATE_FIELDS = ['plannedStartDate', 'plannedCompletionDate', 'actualStartDate', 'actualCompletionDate', 'dueDate'] as const;

@Injectable()
export class WorkOrdersService {
  constructor(@InjectRepository(WorkOrder) private readonly repo: Repository<WorkOrder>) {}

  async findAll(q: QueryWorkOrdersDto): Promise<WorkOrder[]> {
    const base: Record<string, unknown> = {};
    if (q.status) base.workOrderStatus = q.status;
    if (q.lotNumber) base.lotNumber = q.lotNumber;
    if (q.itemNumber) base.itemNumber = q.itemNumber;
    const where = q.search
      ? ['workOrderNumber', 'itemNumber', 'lotNumber', 'customerName'].map((f) => ({ ...base, [f]: ILike(`%${q.search}%`) }))
      : base;
    return this.repo.find({ where, order: { dueDate: { direction: 'ASC', nulls: 'LAST' }, createdAt: 'DESC' }, take: 1000 });
  }

  async findOne(id: string): Promise<WorkOrder> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'WORK_ORDER_NOT_FOUND', message: 'Không tìm thấy lệnh sản xuất' });
    return row;
  }

  async create(dto: CreateWorkOrderDto): Promise<WorkOrder> {
    const exists = await this.repo.findOne({ where: { workOrderNumber: dto.workOrderNumber } });
    if (exists)
      throw new ConflictException({ code: 'WORK_ORDER_DUPLICATE', message: `Lệnh sản xuất ${dto.workOrderNumber} đã tồn tại` });
    const entity = this.repo.create(this.normalise(dto) as Partial<WorkOrder>);
    this.validate(entity);
    this.applyStatusRules(entity);
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateWorkOrderDto): Promise<WorkOrder> {
    const row = await this.findOne(id);
    if (dto.workOrderNumber && dto.workOrderNumber !== row.workOrderNumber) {
      const dup = await this.repo.findOne({ where: { workOrderNumber: dto.workOrderNumber } });
      if (dup)
        throw new ConflictException({ code: 'WORK_ORDER_DUPLICATE', message: `Lệnh sản xuất ${dto.workOrderNumber} đã tồn tại` });
    }
    Object.assign(row, this.normalise(dto));
    this.validate(row);
    this.applyStatusRules(row);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.findOne(id);
    await this.repo.remove(row);
  }

  /** Chuỗi ngày ISO -> Date; chuỗi rỗng -> null để cho phép xóa giá trị. */
  private normalise(dto: object): Record<string, unknown> {
    const out: Record<string, unknown> = { ...dto };
    for (const f of DATE_FIELDS) {
      if (f in out) out[f] = out[f] ? new Date(out[f] as string) : null;
    }
    return out;
  }

  private validate(wo: WorkOrder): void {
    if (wo.completedQuantity + wo.scrappedQuantity > wo.plannedStartQuantity) {
      throw new BadRequestException({
        code: 'WORK_ORDER_QUANTITY_EXCEEDED',
        message: 'Số lượng hoàn thành + phế phẩm không được vượt quá số lượng kế hoạch',
      });
    }
    if (wo.plannedStartDate && wo.plannedCompletionDate && wo.plannedCompletionDate < wo.plannedStartDate) {
      throw new BadRequestException({
        code: 'WORK_ORDER_DATE_ORDER',
        message: 'Ngày hoàn thành kế hoạch phải sau ngày bắt đầu kế hoạch',
      });
    }
  }

  /** Tự điền ngày thực tế khi lệnh chuyển trạng thái. */
  private applyStatusRules(wo: WorkOrder): void {
    if (wo.workOrderStatus === 'COMPLETED' && !wo.actualCompletionDate) wo.actualCompletionDate = new Date();
    if ((wo.workOrderStatus === 'RELEASED' || wo.workOrderStatus === 'COMPLETED') && !wo.actualStartDate)
      wo.actualStartDate = new Date();
  }
}
