import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignPartDto {
  @ApiPropertyOptional({ nullable: true, description: 'null to unassign' })
  @IsOptional()
  @IsUUID()
  containerId?: string | null;
}
