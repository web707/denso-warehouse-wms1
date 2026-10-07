import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Payload JSON theo đúng tên trường trong tài liệu Oracle Fusion Cloud Shipping (Khâu 5).
 * ShipmentId và DelayDays là trường chỉ xuất: nếu gửi lên sẽ bị bỏ qua (hệ thống tự sinh/tự tính).
 */
export class OracleShipmentDto {
  @ApiProperty({ example: 'SHP-2026-0001' }) @IsString() ShipmentNumber: string;
  @ApiPropertyOptional({ description: 'Chỉ xuất, bỏ qua khi nhập' }) @IsOptional() @IsInt() ShipmentId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() CustomerNumber?: string;
  @ApiProperty({ example: 'Toyota' }) @IsString() CustomerName: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() RequestedShipDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() ActualShipDate?: string;
  @ApiPropertyOptional({ example: 'Released', description: 'Released / Shipped / Delivered (không phân biệt hoa thường)' })
  @IsOptional() @IsString() ShipmentStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() CarrierCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() TrackingNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) GrossWeight?: number;
  @ApiPropertyOptional({ example: 'KG' }) @IsOptional() @IsString() WeightUOMCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) ShippedQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() LotNumber?: string;
  @ApiProperty({ example: 'A009' }) @IsString() ItemNumber: string;
  @ApiPropertyOptional() @IsOptional() @IsString() SourceOrderNumber?: string;
  @ApiPropertyOptional({ description: 'Chỉ xuất, bỏ qua khi nhập' }) @IsOptional() @IsInt() DelayDays?: number;
}
