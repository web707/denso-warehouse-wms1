import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateZoneDto {
  @ApiProperty({ example: 'DENSO-WH' }) @IsString() warehouseCode: string;
  @ApiProperty({ example: 'ZONE-B' }) @IsString() code: string;
  @ApiProperty({ example: 'Khu linh kiện điện' }) @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
