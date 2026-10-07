import { computeDelayDays } from './shipments.service';

const d = (s: string) => new Date(s);

describe('computeDelayDays', () => {
  it('null khi thiếu ngày yêu cầu', () => {
    expect(computeDelayDays({ requestedShipDate: null, actualShipDate: null, shipmentStatus: 'RELEASED' })).toBeNull();
  });

  it('đã giao đúng hạn hoặc sớm thì trễ 0 ngày', () => {
    expect(
      computeDelayDays({ requestedShipDate: d('2026-10-10'), actualShipDate: d('2026-10-08'), shipmentStatus: 'SHIPPED' }),
    ).toBe(0);
  });

  it('đã giao trễ tính theo ngày giao thực tế', () => {
    expect(
      computeDelayDays({ requestedShipDate: d('2026-10-10'), actualShipDate: d('2026-10-13'), shipmentStatus: 'DELIVERED' }),
    ).toBe(3);
  });

  it('chưa giao thì tính tới hiện tại', () => {
    expect(
      computeDelayDays(
        { requestedShipDate: d('2026-10-01'), actualShipDate: null, shipmentStatus: 'RELEASED' },
        d('2026-10-06'),
      ),
    ).toBe(5);
  });
});
