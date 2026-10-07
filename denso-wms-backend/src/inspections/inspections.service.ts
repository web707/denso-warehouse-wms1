import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateInspectionDto, QueryInspectionsDto, UpdateInspectionDto } from './dto/create-inspection.dto';
import { Inspection } from './entities/inspection.entity';

export interface LotQualityStatus {
  lotNumber: string;
  judgment: string;
  inspectionId: string;
  inspectionType: string;
  inspectionDate: Date;
}

/** Kết luận mặc định khi người dùng không chọn: có lỗi hoặc đo ngoài dung sai thì NG. */
export function deriveJudgment(i: Pick<Inspection, 'failQuantity' | 'measuredValue1' | 'upperTolerance' | 'lowerTolerance'>): 'OK' | 'NG' {
  return i.failQuantity > 0 || isOutOfTolerance(i) ? 'NG' : 'OK';
}

export function isOutOfTolerance(i: Pick<Inspection, 'measuredValue1' | 'upperTolerance' | 'lowerTolerance'>): boolean {
  if (i.measuredValue1 === null || i.measuredValue1 === undefined) return false;
  if (i.upperTolerance !== null && i.upperTolerance !== undefined && i.measuredValue1 > i.upperTolerance) return true;
  if (i.lowerTolerance !== null && i.lowerTolerance !== undefined && i.measuredValue1 < i.lowerTolerance) return true;
  return false;
}

@Injectable()
export class InspectionsService {
  constructor(@InjectRepository(Inspection) private readonly repo: Repository<Inspection>) {}

  async findAll(q: QueryInspectionsDto): Promise<Inspection[]> {
    const base: Record<string, unknown> = {};
    if (q.judgment) base.judgment = q.judgment;
    if (q.lotNumber) base.lotNumber = q.lotNumber;
    if (q.workOrderNumber) base.workOrderNumber = q.workOrderNumber;
    const where = q.search
      ? ['inspectionId', 'lotNumber', 'workOrderNumber', 'defectCode', 'inspectorId'].map((f) => ({ ...base, [f]: ILike(`%${q.search}%`) }))
      : base;
    return this.repo.find({ where, order: { inspectionDate: 'DESC' }, take: 1000 });
  }

  async findOne(id: string): Promise<Inspection> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'INSPECTION_NOT_FOUND', message: 'Không tìm thấy phiếu kiểm tra' });
    return row;
  }

  /** Kết luận mới nhất của từng lô — dùng để cảnh báo hàng NG/HOLD trong kho. */
  async lotStatus(): Promise<LotQualityStatus[]> {
    const rows = await this.repo.find({ order: { inspectionDate: 'DESC' }, take: 5000 });
    const latest = new Map<string, LotQualityStatus>();
    for (const r of rows) {
      if (!latest.has(r.lotNumber)) {
        latest.set(r.lotNumber, {
          lotNumber: r.lotNumber,
          judgment: r.judgment,
          inspectionId: r.inspectionId,
          inspectionType: r.inspectionType,
          inspectionDate: r.inspectionDate,
        });
      }
    }
    return [...latest.values()];
  }

  async create(dto: CreateInspectionDto): Promise<Inspection> {
    const inspectionId = dto.inspectionId || (await this.generateId());
    if (await this.repo.findOne({ where: { inspectionId } }))
      throw new ConflictException({ code: 'INSPECTION_DUPLICATE', message: `Phiếu kiểm tra ${inspectionId} đã tồn tại` });

    const entity = this.repo.create({
      ...dto,
      inspectionId,
      inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : new Date(),
    } as Partial<Inspection>);
    if (!dto.judgment) entity.judgment = deriveJudgment(entity);
    this.validate(entity);
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateInspectionDto): Promise<Inspection> {
    const row = await this.findOne(id);
    if (dto.inspectionId && dto.inspectionId !== row.inspectionId) {
      if (await this.repo.findOne({ where: { inspectionId: dto.inspectionId } }))
        throw new ConflictException({ code: 'INSPECTION_DUPLICATE', message: `Phiếu kiểm tra ${dto.inspectionId} đã tồn tại` });
    }
    Object.assign(row, dto, dto.inspectionDate ? { inspectionDate: new Date(dto.inspectionDate) } : {});
    this.validate(row);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    await this.repo.remove(await this.findOne(id));
  }

  private validate(i: Inspection): void {
    if (i.passQuantity + i.failQuantity > i.sampleSize) {
      throw new BadRequestException({
        code: 'INSPECTION_QUANTITY_EXCEEDED',
        message: 'Số đạt + số lỗi không được vượt quá cỡ mẫu',
      });
    }
    if (
      i.upperTolerance !== null && i.upperTolerance !== undefined &&
      i.lowerTolerance !== null && i.lowerTolerance !== undefined &&
      i.upperTolerance < i.lowerTolerance
    ) {
      throw new BadRequestException({ code: 'INSPECTION_TOLERANCE', message: 'Dung sai trên phải lớn hơn hoặc bằng dung sai dưới' });
    }
    if (i.judgment === 'OK' && (i.failQuantity > 0 || isOutOfTolerance(i))) {
      throw new BadRequestException({
        code: 'INSPECTION_JUDGMENT_CONFLICT',
        message: 'Không thể kết luận OK khi có sản phẩm lỗi hoặc giá trị đo nằm ngoài dung sai. Hãy chọn NG hoặc HOLD',
      });
    }
  }

  private async generateId(): Promise<string> {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = `INS-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      if (!(await this.repo.findOne({ where: { inspectionId: id } }))) return id;
    }
    return `INS-${stamp}-${Date.now().toString(36).toUpperCase()}`;
  }
}
