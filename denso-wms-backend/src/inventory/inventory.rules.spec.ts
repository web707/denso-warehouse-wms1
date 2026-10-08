import { BadRequestException } from '@nestjs/common';
import {
  LoadItem, assertCapacity, assertInboundLocation, planOutbound, planTransfer, rackLimits,
} from './inventory.rules';

const stock = { quantityPcs: 756, cartonCount: 21, weightKg: 115.5 };
const codeOf = (fn: () => unknown): string | undefined => {
  try { fn(); } catch (e) { return ((e as BadRequestException).getResponse() as { code: string }).code; }
  return undefined;
};

describe('planOutbound', () => {
  it('xuất một phần: các chiều giảm đúng', () => {
    const p = planOutbound(stock, { qty: 36, cartons: 1, weight: 5.5 });
    expect(p.after).toEqual({ quantityPcs: 720, cartonCount: 20, weightKg: 110 });
    expect(p.depleted).toBe(false);
    expect(p.loggedWeight).toBe(5.5);
  });

  it('xuất hết: khối lượng còn lại được tính là đã xuất và ghi vào sổ', () => {
    const p = planOutbound(stock, { qty: 756, cartons: 21, weight: 100 });
    expect(p.depleted).toBe(true);
    expect(p.after.weightKg).toBe(0);
    expect(p.loggedWeight).toBe(115.5);
  });

  it('từ chối xuất vượt tồn ở bất kỳ chiều nào', () => {
    expect(codeOf(() => planOutbound(stock, { qty: 757, cartons: 0, weight: 0 }))).toBe('OUTBOUND_EXCEEDS_STOCK');
    expect(codeOf(() => planOutbound(stock, { qty: 0, cartons: 22, weight: 0 }))).toBe('OUTBOUND_EXCEEDS_STOCK');
    expect(codeOf(() => planOutbound(stock, { qty: 0, cartons: 0, weight: 120 }))).toBe('OUTBOUND_EXCEEDS_STOCK');
  });

  it('từ chối "tồn ma": hết thùng mà còn cái, hoặc hết cái mà còn thùng', () => {
    expect(codeOf(() => planOutbound(stock, { qty: 0, cartons: 21, weight: 0 }))).toBe('OUTBOUND_INCONSISTENT');
    expect(codeOf(() => planOutbound(stock, { qty: 756, cartons: 0, weight: 0 }))).toBe('OUTBOUND_INCONSISTENT');
  });

  it('từ chối xuất hết khối lượng khi còn hàng', () => {
    expect(codeOf(() => planOutbound(stock, { qty: 10, cartons: 0, weight: 115.5 }))).toBe('OUTBOUND_INCONSISTENT');
  });

  it('PART không có khối lượng hoặc thùng vẫn xuất được từng phần theo số lượng', () => {
    expect(planOutbound({ quantityPcs: 100, cartonCount: 0, weightKg: 0 }, { qty: 40, cartons: 0, weight: 0 }).after.quantityPcs).toBe(60);
  });
});

describe('assertInboundLocation', () => {
  const here = { rackId: 'R1', slot: 3 };
  it('cho nhập vào đúng vị trí hiện tại hoặc để trống', () => {
    expect(codeOf(() => assertInboundLocation(here, {}, 'P'))).toBeUndefined();
    expect(codeOf(() => assertInboundLocation(here, { toRackId: 'R1', toSlot: 3 }, 'P'))).toBeUndefined();
  });
  it('cho gán vị trí khi PART chưa có kệ', () => {
    expect(codeOf(() => assertInboundLocation({ rackId: null, slot: null }, { toRackId: 'R9', toSlot: 0 }, 'P'))).toBeUndefined();
  });
  it('từ chối nhập vào kệ hoặc ô khác (sẽ dời cả tồn cũ)', () => {
    expect(codeOf(() => assertInboundLocation(here, { toRackId: 'R2' }, 'P'))).toBe('INBOUND_LOCATION_MISMATCH');
    expect(codeOf(() => assertInboundLocation(here, { toRackId: 'R1', toSlot: 4 }, 'P'))).toBe('INBOUND_LOCATION_MISMATCH');
  });
});

describe('planTransfer', () => {
  it('bỏ trống số lượng: chuyển toàn bộ', () => {
    expect(planTransfer(stock, { qty: 0, cartons: 0, weight: 0 })).toEqual({ qty: 756, cartons: 21, weight: 115.5 });
  });
  it('nhập đúng toàn bộ thì chấp nhận', () => {
    expect(planTransfer(stock, { qty: 756, cartons: 21, weight: 115.5 }).qty).toBe(756);
  });
  it('từ chối chuyển một phần', () => {
    expect(codeOf(() => planTransfer(stock, { qty: 10, cartons: 0, weight: 0 }))).toBe('TRANSFER_PARTIAL_UNSUPPORTED');
    expect(codeOf(() => planTransfer(stock, { qty: 0, cartons: 0, weight: 50 }))).toBe('TRANSFER_PARTIAL_UNSUPPORTED');
  });
});

describe('rackLimits', () => {
  const rack = { maxPayloadKgOverride: null, maxCbmOverride: null, containerType: { maxPayloadKg: '20000', maxCbm: '12.5' } };
  it('tải trọng bị chặn ở mức chung của kho (10.000 kg), thể tích theo loại kệ', () => {
    expect(rackLimits(rack)).toEqual({ rackKg: 10000, rackCbm: 12.5 });
  });
  it('dùng giá trị ghi đè khi có', () => {
    expect(rackLimits({ ...rack, maxPayloadKgOverride: '8000', maxCbmOverride: '9' })).toEqual({ rackKg: 8000, rackCbm: 9 });
  });
});

describe('assertCapacity', () => {
  const limits = { rackKg: 10000, rackCbm: 12 };
  const base = { rackName: 'R01', partName: 'P', limits, others: [] as LoadItem[], before: null as LoadItem | null };
  const item = (weightKg: number, cbm: number, slot: number | null): LoadItem => ({ weightKg, cbm, slot });

  it('chấp nhận trong giới hạn', () => {
    expect(codeOf(() => assertCapacity({ ...base, after: item(400, 1, 2) }))).toBeUndefined();
  });
  it('từ chối vượt 500 kg một ô', () => {
    expect(codeOf(() => assertCapacity({ ...base, after: item(50000, 1, 2) }))).toBe('RACK_CAPACITY_EXCEEDED');
  });
  it('từ chối vượt 2.000 kg một tầng (5 ô cùng tầng)', () => {
    const others = [0, 1, 2, 3].map((s) => item(480, 1, s)); // 1.920 kg tầng 1
    expect(codeOf(() => assertCapacity({ ...base, others, after: item(100, 1, 4) }))).toBe('RACK_CAPACITY_EXCEEDED');
    // ô ở tầng khác thì không bị tính chung
    expect(codeOf(() => assertCapacity({ ...base, others, after: item(100, 1, 5) }))).toBeUndefined();
  });
  it('từ chối vượt tải trọng kệ', () => {
    const others = Array.from({ length: 20 }, (_, i) => item(490, 0.1, i)); // 9.800 kg
    expect(codeOf(() => assertCapacity({ ...base, others: others.slice(0, 19), after: item(500, 0.1, null) }))).toBeUndefined();
    expect(codeOf(() => assertCapacity({ ...base, others, after: item(300, 0.1, null) }))).toBe('RACK_CAPACITY_EXCEEDED');
  });
  it('từ chối vượt thể tích kệ', () => {
    expect(codeOf(() => assertCapacity({ ...base, others: [item(10, 11.5, null)], after: item(10, 1, null) }))).toBe('RACK_CAPACITY_EXCEEDED');
  });
  it('kệ đã quá tải từ trước: vẫn cho thao tác không làm tăng tải', () => {
    const before = item(600, 1, 2); // đã vượt 500 kg ô từ trước
    expect(codeOf(() => assertCapacity({ ...base, before, after: item(600, 1, 2) }))).toBeUndefined();
    expect(codeOf(() => assertCapacity({ ...base, before, after: item(550, 1, 2) }))).toBeUndefined();
    expect(codeOf(() => assertCapacity({ ...base, before, after: item(700, 1, 2) }))).toBe('RACK_CAPACITY_EXCEEDED');
  });
});
