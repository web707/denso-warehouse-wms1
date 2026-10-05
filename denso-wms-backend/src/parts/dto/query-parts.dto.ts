import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryPartsDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() containerId?: string;
}
