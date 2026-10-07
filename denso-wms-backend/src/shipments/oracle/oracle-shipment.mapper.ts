import { BadRequestException } from '@nestjs/common';
import { CreateShipmentDto } from '../dto/create-shipment.dto';
import { Shipment } from '../entities/shipment.entity';
import { OracleShipmentDto } from './oracle-shipment.dto';

/** Đúng 16 trường trong tài liệu Khâu 5, theo đúng thứ tự. */
export interface OracleShipment {
  ShipmentNumber: string;
  ShipmentId: number;
  CustomerNumber: string | null;
  CustomerName: string;
  RequestedShipDate: string | null;
  ActualShipDate: string | null;
  ShipmentStatus: 'Released' | 'Shipped' | 'Delivered';
  CarrierCode: string | null;
  TrackingNumber: string | null;
  GrossWeight: number | null;
  WeightUOMCode: string;
  ShippedQuantity: number;
  LotNumber: string | null;
  ItemNumber: string;
  SourceOrderNumber: string | null;
  DelayDays: number | null;
}

const STATUS_OUT: Record<string, OracleShipment['ShipmentStatus']> = {
  RELEASED: 'Released',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
};

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

export function toOracleShipment(s: Shipment, delayDays: number | null): OracleShipment {
  return {
    ShipmentNumber: s.shipmentNumber,
    ShipmentId: s.shipmentId,
    CustomerNumber: s.customerNumber,
    CustomerName: s.customerName,
    RequestedShipDate: iso(s.requestedShipDate),
    ActualShipDate: iso(s.actualShipDate),
    ShipmentStatus: STATUS_OUT[s.shipmentStatus] ?? 'Released',
    CarrierCode: s.carrierCode,
    TrackingNumber: s.trackingNumber,
    GrossWeight: s.grossWeight,
    WeightUOMCode: s.weightUomCode,
    ShippedQuantity: s.shippedQuantity,
    LotNumber: s.lotNumber,
    ItemNumber: s.itemNumber,
    SourceOrderNumber: s.sourceOrderNumber,
    DelayDays: delayDays,
  };
}

export function fromOracleShipment(p: OracleShipmentDto): CreateShipmentDto {
  let shipmentStatus: string | undefined;
  if (p.ShipmentStatus) {
    shipmentStatus = p.ShipmentStatus.trim().toUpperCase();
    if (!STATUS_OUT[shipmentStatus]) {
      throw new BadRequestException({
        code: 'ORACLE_SHIPMENT_STATUS',
        message: `ShipmentStatus "${p.ShipmentStatus}" không hợp lệ. Chỉ nhận Released, Shipped hoặc Delivered`,
      });
    }
  }
  const dto: CreateShipmentDto = {
    shipmentNumber: p.ShipmentNumber,
    customerName: p.CustomerName,
    itemNumber: p.ItemNumber,
    shipmentStatus,
    customerNumber: p.CustomerNumber,
    requestedShipDate: p.RequestedShipDate,
    actualShipDate: p.ActualShipDate,
    carrierCode: p.CarrierCode,
    trackingNumber: p.TrackingNumber,
    grossWeight: p.GrossWeight,
    weightUomCode: p.WeightUOMCode,
    shippedQuantity: p.ShippedQuantity,
    lotNumber: p.LotNumber,
    sourceOrderNumber: p.SourceOrderNumber,
  };
  // Oracle hay gửi null cho trường trống; bỏ khỏi payload để dùng giá trị mặc định
  return Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== null && v !== undefined)) as unknown as CreateShipmentDto;
}
