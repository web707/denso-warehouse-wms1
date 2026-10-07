import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { SHIPMENT_STATUSES } from '../entities/shipment.entity';

export class CreateShipmentDto {
  @ApiProperty({ example: 'SHP-2026-0001' }) @IsString() shipmentNumber: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerNumber?: string;
  @ApiProperty({ example: 'Toyota' }) @IsString() customerName: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() requestedShipDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualShipDate?: string;
  @ApiPropertyOptional({ enum: SHIPMENT_STATUSES }) @IsOptional() @IsIn(SHIPMENT_STATUSES as unknown as string[]) shipmentStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() carrierCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trackingNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) grossWeight?: number;
  @ApiPropertyOptional({ example: 'KG' }) @IsOptional() @IsString() weightUomCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) shippedQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
  @ApiProperty({ example: 'A009' }) @IsString() itemNumber: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceOrderNumber?: string;
}

export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {}

export class QueryShipmentsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
}
