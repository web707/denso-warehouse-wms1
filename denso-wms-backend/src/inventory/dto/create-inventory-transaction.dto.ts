import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { InventoryTransactionType } from '../entities/inventory-transaction.entity';

export class CreateInventoryTransactionDto {
  @ApiProperty({ enum: InventoryTransactionType })
  @IsEnum(InventoryTransactionType)
  type: InventoryTransactionType;

  @ApiProperty()
  @IsUUID()
  partId: string;

  @ApiPropertyOptional({ description: 'Dùng cho nhập/xuất; điều chuyển có thể để 0' })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantityPcs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  cartonCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toRackId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 19, description: '0-based S01..S20' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(19)
  toSlot?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
