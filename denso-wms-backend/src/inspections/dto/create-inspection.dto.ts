import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { INSPECTION_TYPES, JUDGMENTS } from '../entities/inspection.entity';

export class CreateInspectionDto {
  @ApiPropertyOptional({ example: 'INS-20261006-A1B2', description: 'Bỏ trống để hệ thống tự sinh' })
  @IsOptional() @IsString() inspectionId?: string;

  @ApiProperty({ example: 'LOT-2026-001' }) @IsString() lotNumber: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workOrderNumber?: string;
  @ApiPropertyOptional({ enum: INSPECTION_TYPES }) @IsOptional() @IsIn(INSPECTION_TYPES as unknown as string[]) inspectionType?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() inspectionDate?: string;

  @ApiProperty({ example: 100 }) @IsInt() @Min(0) sampleSize: number;
  @ApiProperty({ example: 98 }) @IsInt() @Min(0) passQuantity: number;
  @ApiProperty({ example: 2 }) @IsInt() @Min(0) failQuantity: number;

  @ApiPropertyOptional({
    enum: JUDGMENTS,
    description: 'Bỏ trống: NG nếu có sản phẩm lỗi hoặc giá trị đo ngoài dung sai, ngược lại OK',
  })
  @IsOptional() @IsIn(JUDGMENTS as unknown as string[]) judgment?: string;

  @ApiPropertyOptional({ example: 'D-101' }) @IsOptional() @IsString() defectCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() measuredValue1?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() upperTolerance?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lowerTolerance?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() inspectorId?: string;
}

export class UpdateInspectionDto extends PartialType(CreateInspectionDto) {}

export class QueryInspectionsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() judgment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workOrderNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
