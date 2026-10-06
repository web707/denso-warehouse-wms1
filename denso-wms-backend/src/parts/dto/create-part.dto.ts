import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: 'LOT-2026-001', description: 'Oracle: LotNumber' })
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional({ example: 'EA', description: 'Oracle: UOMCode (EA, KG, ROLL...)' })
  @IsOptional()
  @IsString()
  uomCode?: string;

  @ApiPropertyOptional({ example: 12.5, description: 'Oracle: UnitCost' })
  @IsOptional()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ example: '2027-12-31', description: 'Oracle: ExpirationDate' })
  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @ApiPropertyOptional({ example: 'Nhà cung cấp A', description: 'Oracle: SupplierName' })
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ example: 1001, description: 'Oracle: SupplierId' })
  @IsOptional()
  @IsInt()
  supplierId?: number;

  @ApiPropertyOptional({ example: 'HN-01', description: 'Oracle: SupplierSiteCode' })
  @IsOptional()
  @IsString()
  supplierSiteCode?: string;
}
