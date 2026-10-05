import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AssignRackDto {
  @ApiPropertyOptional({ nullable: true, description: 'Rack id; null to unassign from rack' })
  @IsOptional()
  @IsUUID()
  rackId?: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 19, description: 'Preferred storage slot index S01..S20 as 0..19' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(19)
  slotIndex?: number | null;
}
