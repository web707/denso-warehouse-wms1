import { ContainerDims, SolverPart } from '../domain/types';
import { packDivisionAware, packGlobalPool } from './space-packer';

const container: ContainerDims = {
  internalLengthMm: 100,
  internalWidthMm: 100,
  internalHeightMm: 100,
  doorHeightMm: null,
  maxCbm: 1,
  maxPayloadKg: 1000,
};

function part(overrides: Partial<SolverPart> = {}): SolverPart {
  return {
    id: overrides.id ?? 'part',
    partName: overrides.partName ?? 'PART',
    masterPo: overrides.masterPo ?? '1',
    divisionSortOrder: overrides.divisionSortOrder ?? 1,
    dcPrefixSortOrder: overrides.dcPrefixSortOrder ?? 1,
    dcPrefixCode: overrides.dcPrefixCode ?? 'DC',
    divisionCode: overrides.divisionCode ?? 'D1',
    cartonCount: overrides.cartonCount ?? 1,
    cartonLengthMm: overrides.cartonLengthMm ?? 100,
    cartonWidthMm: overrides.cartonWidthMm ?? 100,
    cartonHeightMm: overrides.cartonHeightMm ?? 100,
    totalWeightKg: overrides.totalWeightKg ?? 1,
    colorHex: overrides.colorHex ?? '#000000',
  };
}

describe('packDivisionAware', () => {
  it('g?p c�c PART c�ng k�ch thu?c th�nh m?t block nhung v?n gi? ownership theo PART', () => {
    const result = packDivisionAware(
      [part({ id: 'a', cartonCount: 2 }), part({ id: 'b', masterPo: '2', cartonCount: 2 })],
      { ...container, internalLengthMm: 200, internalHeightMm: 200 },
    );

    expect(result.placements).toHaveLength(4);
    expect(result.unplacedByPart).toEqual({ a: 0, b: 0 });
    expect(result.placements.filter((placement) => placement.partId === 'a')).toHaveLength(2);
    expect(result.placements.filter((placement) => placement.partId === 'b')).toHaveLength(2);
  });

  it('th? d? ho�n v? 3 chi?u d? nh�t th�ng v�o khe h?p', () => {
    const result = packDivisionAware(
      [part({ id: 'fit', cartonLengthMm: 45, cartonWidthMm: 38, cartonHeightMm: 16 })],
      {
        ...container,
        internalLengthMm: 50,
        internalWidthMm: 20,
        internalHeightMm: 40,
      },
    );

    expect(result.unplacedByPart).toEqual({ fit: 0 });
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).toMatchObject({ dxMm: 45, dyMm: 16, dzMm: 38, rotated: true });
  });

  it('gi? division sau ? v�ng x ti?p theo, kh�ng dan xen v?i division tru?c', () => {
    const result = packDivisionAware(
      [
        part({
          id: 'a',
          divisionCode: 'D1',
          cartonCount: 2,
          cartonLengthMm: 100,
          cartonWidthMm: 50,
        }),
        part({
          id: 'b',
          masterPo: '2',
          divisionCode: 'D2',
          divisionSortOrder: 2,
          cartonCount: 1,
          cartonLengthMm: 100,
          cartonWidthMm: 50,
        }),
      ],
      { ...container, internalLengthMm: 300, internalWidthMm: 100, internalHeightMm: 100 },
    );

    const firstDivisionEnd = Math.max(
      ...result.placements
        .filter((placement) => placement.partId === 'a')
        .map((placement) => placement.xMm + placement.dxMm),
    );
    const secondDivisionStart = Math.min(
      ...result.placements
        .filter((placement) => placement.partId === 'b')
        .map((placement) => placement.xMm),
    );

    expect(result.unplacedByPart).toEqual({ a: 0, b: 0 });
    expect(secondDivisionStart).toBeGreaterThanOrEqual(firstDivisionEnd);
  });

  it('x?p d? k?ch b?n 256 th�ng to v� 252 th�ng nh? trong 20DC theo block-split', () => {
    const result = packDivisionAware(
      [
        part({
          id: 'big',
          cartonCount: 256,
          cartonLengthMm: 610,
          cartonWidthMm: 510,
          cartonHeightMm: 270,
        }),
        part({
          id: 'small',
          masterPo: '2',
          cartonCount: 252,
          cartonLengthMm: 450,
          cartonWidthMm: 380,
          cartonHeightMm: 160,
        }),
      ],
      {
        internalLengthMm: 5898,
        internalWidthMm: 2352,
        internalHeightMm: 2395,
        doorHeightMm: 2280,
        maxCbm: 33.2,
        maxPayloadKg: 28280,
      },
    );

    expect(result.unplacedByPart).toEqual({ big: 0, small: 0 });
    expect(result.placements).toHaveLength(508);
  });
});

describe('packGlobalPool', () => {
  const container20DC: ContainerDims = {
    internalLengthMm: 5898,
    internalWidthMm: 2352,
    internalHeightMm: 2395,
    doorHeightMm: 2280,
    maxCbm: 33.2,
    maxPayloadKg: 28280,
  };

  it('x?p d? 508/508 khi 3 division chia s? c�ng k�ch thu?c th�ng to, kh�ng b? k?t nhu packDivisionAware', () => {
    const hgBig = part({
      id: 'hg-big',
      divisionCode: 'HG',
      divisionSortOrder: 1,
      cartonCount: 64,
      cartonLengthMm: 610,
      cartonWidthMm: 510,
      cartonHeightMm: 270,
    });
    const hgSmall = part({
      id: 'hg-small',
      divisionCode: 'HG',
      divisionSortOrder: 1,
      masterPo: '2',
      cartonCount: 252,
      cartonLengthMm: 450,
      cartonWidthMm: 380,
      cartonHeightMm: 160,
    });
    const mar = part({
      id: 'mar-big',
      divisionCode: 'MAR',
      divisionSortOrder: 2,
      masterPo: '3',
      cartonCount: 84,
      cartonLengthMm: 610,
      cartonWidthMm: 510,
      cartonHeightMm: 270,
    });
    const tjm = part({
      id: 'tjm-big',
      divisionCode: 'TJM',
      divisionSortOrder: 3,
      masterPo: '4',
      cartonCount: 108,
      cartonLengthMm: 610,
      cartonWidthMm: 510,
      cartonHeightMm: 270,
    });

    const strict = packDivisionAware([hgBig, hgSmall, mar, tjm], container20DC);
    const pooled = packGlobalPool([hgBig, hgSmall, mar, tjm], container20DC);

    // The old per-division split leaves TJM short because HG's small-carton
    // wall eats into the length MAR/TJM get to work with.
    expect(strict.unplacedByPart['tjm-big']).toBeGreaterThan(0);

    expect(pooled.unplacedByPart).toEqual({
      'hg-big': 0,
      'hg-small': 0,
      'mar-big': 0,
      'tjm-big': 0,
    });
    expect(pooled.placements).toHaveLength(508);
    expect(pooled.placements.filter((placement) => placement.partId === 'hg-big')).toHaveLength(64);
    expect(pooled.placements.filter((placement) => placement.partId === 'hg-small')).toHaveLength(
      252,
    );
    expect(pooled.placements.filter((placement) => placement.partId === 'mar-big')).toHaveLength(
      84,
    );
    expect(pooled.placements.filter((placement) => placement.partId === 'tjm-big')).toHaveLength(
      108,
    );

    // 20DC's internal ceiling (2395mm) sits above its door opening (2280mm).
    // No placement may rely on the headroom above the door -- that cargo
    // would never fit back out through the door.
    for (const placement of pooled.placements) {
      expect(placement.zMm + placement.dzMm).toBeLessThanOrEqual(container20DC.doorHeightMm!);
    }
  });
});
