import { BadRequestException } from '@nestjs/common';
import { buildEdifactDesadv, buildX12Asn, ShipmentEdiInput } from './edi/edi.builder';
import { fromOracleShipment, toOracleShipment } from './oracle/oracle-shipment.mapper';
import { OracleShipmentDto } from './oracle/oracle-shipment.dto';
import { Shipment } from './entities/shipment.entity';

const NOW = new Date('2026-10-07T03:04:00Z');

const sample: ShipmentEdiInput = {
  shipmentId: 42,
  shipmentNumber: 'SHP-2026-0001',
  customerNumber: 'C-TOY',
  customerName: 'Toyota',
  requestedShipDate: new Date('2026-10-05T00:00:00Z'),
  actualShipDate: new Date('2026-10-07T00:00:00Z'),
  carrierCode: 'DHL',
  trackingNumber: 'DHL884201',
  grossWeight: 1250,
  weightUomCode: 'KG',
  shippedQuantity: 4950,
  lotNumber: 'LOT-2026-001',
  itemNumber: 'A009',
  sourceOrderNumber: 'PO-TOY-5521',
};

describe('X12 856 ASN', () => {
  const lines = buildX12Asn(sample, { now: NOW }).trim().split('\n');

  it('có vỏ ISA/GS ... GE/IEA, ISA đúng 106 ký tự', () => {
    expect(lines[0].startsWith('ISA*00*')).toBe(true);
    expect(lines[0]).toHaveLength(106);
    expect(lines[1]).toMatch(/^GS\*SH\*DENSOWMS\*CTOY\*20261007\*0304\*42\*X\*004010~$/);
    expect(lines[lines.length - 2]).toBe('GE*1*42~');
    expect(lines[lines.length - 1]).toBe('IEA*1*000000042~');
  });

  it('ISA15 là T (thử nghiệm) theo mặc định và P khi chỉ định', () => {
    expect(lines[0]).toContain('*T*>~');
    expect(buildX12Asn(sample, { now: NOW, usage: 'P' }).split('\n')[0]).toContain('*P*>~');
  });

  it('SE đếm đúng số segment từ ST đến SE', () => {
    const st = lines.findIndex((l) => l.startsWith('ST*'));
    const se = lines.findIndex((l) => l.startsWith('SE*'));
    expect(lines[se]).toBe(`SE*${se - st + 1}*0001~`);
  });

  it('chứa đủ dữ liệu của lô giao', () => {
    const text = lines.join('\n');
    expect(text).toContain('BSN*00*SHP-2026-0001*20261007*0304*0001~');
    expect(text).toContain('TD1******G*1250*KG~');
    expect(text).toContain('TD5**2*DHL~');
    expect(text).toContain('REF*CN*DHL884201~');
    expect(text).toContain('DTM*010*20261005~');
    expect(text).toContain('DTM*011*20261007~');
    expect(text).toContain('N1*ST*Toyota*92*C-TOY~');
    expect(text).toContain('PRF*PO-TOY-5521~');
    expect(text).toContain('LIN**BP*A009*LT*LOT-2026-001~');
    expect(text).toContain('SN1**4950*EA~');
  });

  it('loại bỏ ký tự phân cách khỏi dữ liệu để không làm vỡ file', () => {
    const text = buildX12Asn({ ...sample, customerName: 'A*B~C>D' }, { now: NOW });
    expect(text).toContain('N1*ST*A B C D*92*C-TOY~');
  });

  it('bỏ các segment tùy chọn khi thiếu dữ liệu', () => {
    const text = buildX12Asn(
      { ...sample, actualShipDate: null, trackingNumber: null, carrierCode: null, sourceOrderNumber: null, lotNumber: null, grossWeight: null },
      { now: NOW },
    );
    expect(text).not.toMatch(/DTM\*011|REF\*CN|TD5|PRF|TD1/);
    expect(text).toContain('LIN**BP*A009~');
  });
});

describe('EDIFACT DESADV D.96A', () => {
  const lines = buildEdifactDesadv(sample, { now: NOW }).trim().split('\n');

  it('có UNA, UNB ... UNZ và UNT đếm đúng', () => {
    expect(lines[0]).toBe("UNA:+.? '");
    expect(lines[1]).toBe("UNB+UNOC:3+DENSOWMS:ZZ+CTOY:ZZ+261007:0304+000000042'");
    expect(lines[lines.length - 1]).toBe("UNZ+1+000000042'");
    const unh = lines.findIndex((l) => l.startsWith('UNH+'));
    const unt = lines.findIndex((l) => l.startsWith('UNT+'));
    expect(lines[unt]).toBe(`UNT+${unt - unh + 1}+1'`);
  });

  it('chứa đủ dữ liệu của lô giao', () => {
    const text = lines.join('\n');
    expect(text).toContain("UNH+1+DESADV:D:96A:UN'");
    expect(text).toContain("BGM+351+SHP-2026-0001+9'");
    expect(text).toContain("DTM+10:20261005:102'");
    expect(text).toContain("DTM+11:20261007:102'");
    expect(text).toContain("MEA+WT+G+KGM:1250'");
    expect(text).toContain("RFF+ON:PO-TOY-5521'");
    expect(text).toContain("NAD+ST+C-TOY::92++Toyota'");
    expect(text).toContain("LIN+1++A009:BP'");
    expect(text).toContain("QTY+12:4950:EA'");
    expect(text).toContain("GIN+BX+LOT-2026-001'");
  });

  it("escape các ký tự + : ' ? bằng ký tự giải phóng ?", () => {
    const text = buildEdifactDesadv({ ...sample, customerName: "A+B:C'D?E" }, { now: NOW });
    expect(text).toContain("++A?+B?:C?'D??E'");
  });
});

describe('Oracle JSON mapper', () => {
  const entity = {
    shipmentNumber: 'SHP-2026-0001', shipmentId: 7, customerNumber: 'C-TOY', customerName: 'Toyota',
    requestedShipDate: new Date('2026-10-05T00:00:00Z'), actualShipDate: null, shipmentStatus: 'RELEASED',
    carrierCode: 'DHL', trackingNumber: null, grossWeight: 1250, weightUomCode: 'KG', shippedQuantity: 4950,
    lotNumber: 'LOT-2026-001', itemNumber: 'A009', sourceOrderNumber: 'PO-1',
  } as unknown as Shipment;

  it('xuất đúng 16 trường theo đúng thứ tự trong tài liệu', () => {
    const out = toOracleShipment(entity, 2);
    expect(Object.keys(out)).toEqual([
      'ShipmentNumber', 'ShipmentId', 'CustomerNumber', 'CustomerName', 'RequestedShipDate', 'ActualShipDate',
      'ShipmentStatus', 'CarrierCode', 'TrackingNumber', 'GrossWeight', 'WeightUOMCode', 'ShippedQuantity',
      'LotNumber', 'ItemNumber', 'SourceOrderNumber', 'DelayDays',
    ]);
    expect(out.ShipmentStatus).toBe('Released');
    expect(out.ShipmentId).toBe(7);
    expect(out.RequestedShipDate).toBe('2026-10-05T00:00:00.000Z');
    expect(out.ActualShipDate).toBeNull();
    expect(out.DelayDays).toBe(2);
  });

  it('nhập: đổi tên trường, chuẩn hóa trạng thái, bỏ ShipmentId/DelayDays và giá trị null', () => {
    const dto = Object.assign(new OracleShipmentDto(), {
      ShipmentNumber: 'SHP-9', ShipmentId: 999, CustomerName: 'Honda', ItemNumber: 'A007',
      ShipmentStatus: 'shipped', CarrierCode: null, GrossWeight: 10, DelayDays: 5, WeightUOMCode: 'KG',
    });
    const out = fromOracleShipment(dto) as unknown as Record<string, unknown>;
    expect(out).toEqual({
      shipmentNumber: 'SHP-9', customerName: 'Honda', itemNumber: 'A007', shipmentStatus: 'SHIPPED',
      grossWeight: 10, weightUomCode: 'KG',
    });
  });

  it('từ chối trạng thái không thuộc Released/Shipped/Delivered', () => {
    const dto = Object.assign(new OracleShipmentDto(), { ShipmentNumber: 'X', CustomerName: 'Y', ItemNumber: 'Z', ShipmentStatus: 'Cancelled' });
    expect(() => fromOracleShipment(dto)).toThrow(BadRequestException);
  });
});
