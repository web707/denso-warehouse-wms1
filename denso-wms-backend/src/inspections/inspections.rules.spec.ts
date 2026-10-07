import { deriveJudgment, isOutOfTolerance } from './inspections.service';

describe('inspection rules', () => {
  const base = { failQuantity: 0, measuredValue1: null, upperTolerance: null, lowerTolerance: null };

  it('OK khi không lỗi và không có số đo', () => {
    expect(deriveJudgment(base)).toBe('OK');
  });

  it('NG khi có sản phẩm lỗi', () => {
    expect(deriveJudgment({ ...base, failQuantity: 1 })).toBe('NG');
  });

  it('NG khi đo vượt dung sai trên hoặc dưới', () => {
    expect(isOutOfTolerance({ measuredValue1: 10.2, upperTolerance: 10.1, lowerTolerance: 9.9 })).toBe(true);
    expect(isOutOfTolerance({ measuredValue1: 9.8, upperTolerance: 10.1, lowerTolerance: 9.9 })).toBe(true);
    expect(deriveJudgment({ ...base, measuredValue1: 10.2, upperTolerance: 10.1, lowerTolerance: 9.9 })).toBe('NG');
  });

  it('OK khi đo đúng biên dung sai', () => {
    expect(isOutOfTolerance({ measuredValue1: 10.1, upperTolerance: 10.1, lowerTolerance: 9.9 })).toBe(false);
  });
});
