import { PartialType } from '@nestjs/swagger';
import { CreatePackingRuleDto } from './create-packing-rule.dto';

export class UpdatePackingRuleDto extends PartialType(CreatePackingRuleDto) {}
