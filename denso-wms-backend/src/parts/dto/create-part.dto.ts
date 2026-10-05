import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class CreatePartDto {
  @ApiProperty() @IsUUID() orderId: string;

  @ApiProperty({ example: 'PART 1' }) @IsString() partName: string;

  @ApiPropertyOptional({ example: 'A009' })
  @IsOptional()
  @IsString()
  productCode?: string;

  @ApiProperty() @IsUUID() divisionId: string;

  @ApiProperty() @IsUUID() dcPrefixId: string;

  @ApiProperty({ example: '134736' }) @IsString() masterPo: string;

  @ApiProperty({ example: 756 }) @IsInt() @IsPositive() quantityPcs: number;

  @ApiProperty({ example: 115.5 }) @Min(0) totalWeightKg: number;

  @ApiProperty({ example: 21 }) @IsInt() @IsPositive() cartonCount: number;

  @ApiProperty({ example: 450, description: 'mm' }) @IsInt() @IsPositive() cartonLengthMm: number;

  @ApiProperty({ example: 380, description: 'mm' }) @IsInt() @IsPositive() cartonWidthMm: number;

  @ApiProperty({ example: 160, description: 'mm' }) @IsInt() @IsPositive() cartonHeightMm: number;

  @ApiPropertyOptional({ description: 'Auto-assigned from the palette if omitted' })
  @IsOptional()
  @IsString()
  colorHex?: string;
}
