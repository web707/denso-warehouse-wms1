import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePackingRuleDto } from './dto/create-packing-rule.dto';
import { UpdatePackingRuleDto } from './dto/update-packing-rule.dto';
import { PackingRule } from './entities/packing-rule.entity';

@Injectable()
export class PackingRulesService {
  constructor(@InjectRepository(PackingRule) private readonly rules: Repository<PackingRule>) {}

  findAll(): Promise<PackingRule[]> {
    return this.rules.find({ order: { sortOrder: 'ASC' } });
  }

  async create(dto: CreatePackingRuleDto): Promise<PackingRule> {
    const maxSortOrder = await this.rules
      .createQueryBuilder('r')
      .select('COALESCE(MAX(r.sort_order), 0)', 'max')
      .getRawOne<{ max: number }>();
    return this.rules.save(
      this.rules.create({
        ...dto,
        icon: dto.icon ?? 'Box',
        active: dto.active ?? true,
        isSystem: false,
        sortOrder: (maxSortOrder?.max ?? 0) + 1,
      }),
    );
  }

  async update(id: string, dto: UpdatePackingRuleDto): Promise<PackingRule> {
    const rule = await this.findOneOrFail(id);
    Object.assign(rule, dto);
    return this.rules.save(rule);
  }

  async remove(id: string): Promise<void> {
    const rule = await this.findOneOrFail(id);
    if (rule.isSystem) {
      throw new ConflictException({
        code: 'SYSTEM_RULE_PROTECTED',
        message: 'Không thể xoá quy tắc hệ thống, chỉ có thể tắt (active=false) hoặc sửa nội dung',
      });
    }
    await this.rules.remove(rule);
  }

  private async findOneOrFail(id: string): Promise<PackingRule> {
    const rule = await this.rules.findOne({ where: { id } });
    if (!rule)
      throw new NotFoundException({ code: 'RULE_NOT_FOUND', message: 'Không tìm thấy quy tắc' });
    return rule;
  }
}
