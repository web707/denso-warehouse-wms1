import { ContainerDims, SolverPart } from '../domain/types';
import { solve } from './solve';

const container: ContainerDims = {
  internalLengthMm: 100,
  internalWidthMm: 100,
  internalHeightMm: 100,
  doorHeightMm: null,
  maxCbm: 1,
  maxPayloadKg: 1000,
};

const part: SolverPart = {
  id: 'part-1',
  partName: 'PART 1',
  masterPo: '1',
  divisionSortOrder: 1,
  dcPrefixSortOrder: 1,
  dcPrefixCode: 'DC',
  divisionCode: 'D1',
  cartonCount: 1,
  cartonLengthMm: 100,
  cartonWidthMm: 100,
  cartonHeightMm: 100,
  totalWeightKg: 12,
  colorHex: '#000000',
};

describe('solve', () => {
  it('ch? b�o CBM v� tr?ng lu?ng c?a carton d� du?c x?p', () => {
    const tooShort: ContainerDims = { ...container, internalLengthMm: 99 };

    const result = solve([part], tooShort);

    expect(result.placements).toHaveLength(0);
    expect(result.cbmUsed).toBe(0);
    expect(result.weightUsedKg).toBe(0);
    expect(result.violations[0]).toMatchObject({ code: 'CARTON_TOO_LARGE', partId: part.id });
  });

  it('v?n nh?n carton ch? fit du?c khi ho�n v? d? 3 chi?u', () => {
    const result = solve([{ ...part, cartonLengthMm: 45, cartonWidthMm: 38, cartonHeightMm: 16 }], {
      ...container,
      internalLengthMm: 50,
      internalWidthMm: 20,
      internalHeightMm: 40,
    });

    expect(result.placements).toHaveLength(1);
    expect(result.violations).toEqual([]);
  });
});
