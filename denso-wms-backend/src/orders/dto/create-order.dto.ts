import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 'KH183' })
  @IsString()
  orderNumber: string;

  @ApiPropertyOptional({
    example: 'KH183',
    description: 'Display name for the allocation tab; defaults to orderNumber',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'PAV' })
  @IsString()
  division: string;

  @ApiPropertyOptional({ example: 'USA', default: 'USA' })
  @IsOptional()
  @IsString()
  destination?: string;
}
