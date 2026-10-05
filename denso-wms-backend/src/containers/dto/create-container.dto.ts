import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateContainerDto {
  @ApiProperty()
  @IsUUID()
  containerTypeId: string;

  @ApiProperty({
    description: 'Lô linh kiện mà kệ kho này phục vụ',
  })
  @IsUUID()
  orderId: string;

  @ApiProperty({ example: 'Rack R01' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'DENSO-WH' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ example: 'ZONE-A' })
  @IsOptional()
  @IsString()
  zoneCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxCbmOverride?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxPayloadKgOverride?: number;
}
