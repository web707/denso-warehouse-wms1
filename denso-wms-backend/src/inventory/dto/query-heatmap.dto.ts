import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryHeatmapDto {
  @ApiPropertyOptional({ description: 'Filter by Order UUID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Warehouse code (mặc định DENSO-WH)' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: 'Zone code (ví dụ ZONE-A)' })
  @IsOptional()
  @IsString()
  zoneCode?: string;

  @ApiPropertyOptional({ description: 'Số ngày thống kê lịch sử (mặc định 90 ngày)', default: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 90;
}
