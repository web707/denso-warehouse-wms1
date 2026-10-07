import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min,
} from 'class-validator';
import { WORK_ORDER_STATUSES, WORK_ORDER_TYPES } from '../entities/work-order.entity';

export class CreateWorkOrderDto {
  @ApiProperty({ example: 'WO-2026-0001' }) @IsString() workOrderNumber: string;
  @ApiPropertyOptional({ enum: WORK_ORDER_TYPES }) @IsOptional() @IsIn(WORK_ORDER_TYPES as unknown as string[]) workOrderType?: string;
  @ApiPropertyOptional({ enum: WORK_ORDER_STATUSES }) @IsOptional() @IsIn(WORK_ORDER_STATUSES as unknown as string[]) workOrderStatus?: string;
  @ApiProperty({ example: 'A009' }) @IsString() itemNumber: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() inventoryItemId?: number;
  @ApiPropertyOptional({ example: 'DENSO-WH' }) @IsOptional() @IsString() organizationCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedStartDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() plannedCompletionDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualStartDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() actualCompletionDate?: string;

  @ApiPropertyOptional({ example: 1000 }) @IsOptional() @IsNumber() @Min(0) plannedStartQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) completedQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) scrappedQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) inProcessQuantity?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workDefinitionCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workCenterCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workCenterName?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) operationSequenceNumber?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() operationStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resourceCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() demandSourceHeaderNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() firmPlannedFlag?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() expeditedFlag?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
}

export class UpdateWorkOrderDto extends PartialType(CreateWorkOrderDto) {}

export class QueryWorkOrdersDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() itemNumber?: string;
}
