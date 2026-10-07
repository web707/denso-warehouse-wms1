import { DataSource } from 'typeorm';
import { DcPrefix } from '../../divisions/entities/dc-prefix.entity';
import { Division } from '../../divisions/entities/division.entity';
import { Order } from '../../orders/entities/order.entity';
import { nextPartColor } from '../../parts/constants/part-colors';
import { Part } from '../../parts/entities/part.entity';

interface SamplePartRow {
  divisionCode: string;
  dcPrefix: string;
  masterPo: string;
  partName: string;
  productCode: string;
  quantityPcs: number;
  totalWeightKg: number;
  cartonCount: number;
  cartonLengthCm: number;
  cartonWidthCm: number;
  cartonHeightCm: number;
}

// Every row of the client's "Thông tin hàng" sheet (Synthetic - USA.xlsx),
// transcribed exactly — order KH183 / brand PAV / destination USA.
//
// NOTE — source data quality: the sheet's own TOTAL row reads
// 487 cartons / 32,892 pcs / 5,571.3 kg / 28.397952 CBM, but that is short
// by EXACTLY row 1 of this list (PART 1, M91846/HG/10: 21 cartons / 756 pcs
// / 115.5 kg) — a SUM-range bug in the client's spreadsheet, not something
// this seed should reproduce. The CBM total (28.397952) DOES match exactly
// across all 26 rows. This seed asserts against the true sum of the rows
// actually inserted (508 cartons / 33,648 pcs / 5,686.8 kg), not the
// spreadsheet's undercounted TOTAL cell.
export const SAMPLE_PARTS: SamplePartRow[] = [
  {
    divisionCode: 'HG',
    dcPrefix: '10',
    masterPo: '134736',
    partName: 'PART 1',
    productCode: 'A009',
    quantityPcs: 756,
    totalWeightKg: 115.5,
    cartonCount: 21,
    cartonLengthCm: 45,
    cartonWidthCm: 38,
    cartonHeightCm: 16,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '20',
    masterPo: '134736',
    partName: 'PART 2',
    productCode: 'A009',
    quantityPcs: 2016,
    totalWeightKg: 308.0,
    cartonCount: 56,
    cartonLengthCm: 45,
    cartonWidthCm: 38,
    cartonHeightCm: 16,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '30',
    masterPo: '134736',
    partName: 'PART 3',
    productCode: 'A009',
    quantityPcs: 864,
    totalWeightKg: 132.0,
    cartonCount: 24,
    cartonLengthCm: 45,
    cartonWidthCm: 38,
    cartonHeightCm: 16,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '40',
    masterPo: '134736',
    partName: 'PART 4',
    productCode: 'A009',
    quantityPcs: 900,
    totalWeightKg: 137.5,
    cartonCount: 25,
    cartonLengthCm: 45,
    cartonWidthCm: 38,
    cartonHeightCm: 16,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '50',
    masterPo: '134736',
    partName: 'PART 5',
    productCode: 'A009',
    quantityPcs: 972,
    totalWeightKg: 148.5,
    cartonCount: 27,
    cartonLengthCm: 45,
    cartonWidthCm: 38,
    cartonHeightCm: 16,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '60',
    masterPo: '134736',
    partName: 'PART 6',
    productCode: 'A009',
    quantityPcs: 1044,
    totalWeightKg: 159.5,
    cartonCount: 29,
    cartonLengthCm: 45,
    cartonWidthCm: 38,
    cartonHeightCm: 16,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '70',
    masterPo: '134736',
    partName: 'PART 7',
    productCode: 'A009',
    quantityPcs: 1044,
    totalWeightKg: 159.5,
    cartonCount: 29,
    cartonLengthCm: 45,
    cartonWidthCm: 38,
    cartonHeightCm: 16,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '90',
    masterPo: '134736',
    partName: 'PART 8',
    productCode: 'A009',
    quantityPcs: 1476,
    totalWeightKg: 225.5,
    cartonCount: 41,
    cartonLengthCm: 45,
    cartonWidthCm: 38,
    cartonHeightCm: 16,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '10',
    masterPo: '126496',
    partName: 'PART 1',
    productCode: 'A007',
    quantityPcs: 768,
    totalWeightKg: 134.4,
    cartonCount: 8,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '20',
    masterPo: '126496',
    partName: 'PART 2',
    productCode: 'A007',
    quantityPcs: 576,
    totalWeightKg: 100.8,
    cartonCount: 6,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '30',
    masterPo: '126496',
    partName: 'PART 3',
    productCode: 'A007',
    quantityPcs: 288,
    totalWeightKg: 50.4,
    cartonCount: 3,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '40',
    masterPo: '126496',
    partName: 'PART 4',
    productCode: 'A007',
    quantityPcs: 864,
    totalWeightKg: 151.2,
    cartonCount: 9,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '50',
    masterPo: '126496',
    partName: 'PART 5',
    productCode: 'A007',
    quantityPcs: 576,
    totalWeightKg: 100.8,
    cartonCount: 6,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '60',
    masterPo: '126496',
    partName: 'PART 6',
    productCode: 'A007',
    quantityPcs: 1920,
    totalWeightKg: 336.0,
    cartonCount: 20,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '70',
    masterPo: '126496',
    partName: 'PART 7',
    productCode: 'A007',
    quantityPcs: 672,
    totalWeightKg: 117.6,
    cartonCount: 7,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'HG',
    dcPrefix: '90',
    masterPo: '126496',
    partName: 'PART 8',
    productCode: 'A007',
    quantityPcs: 480,
    totalWeightKg: 84.0,
    cartonCount: 5,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'MAR',
    dcPrefix: '01',
    masterPo: '079550',
    partName: 'PART 1',
    productCode: 'A007',
    quantityPcs: 1824,
    totalWeightKg: 319.2,
    cartonCount: 19,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'MAR',
    dcPrefix: '04',
    masterPo: '079550',
    partName: 'PART 2',
    productCode: 'A007',
    quantityPcs: 1440,
    totalWeightKg: 252.0,
    cartonCount: 15,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'MAR',
    dcPrefix: '06',
    masterPo: '079550',
    partName: 'PART 3',
    productCode: 'A007',
    quantityPcs: 2016,
    totalWeightKg: 352.8,
    cartonCount: 21,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'MAR',
    dcPrefix: '07',
    masterPo: '079550',
    partName: 'PART 4',
    productCode: 'A007',
    quantityPcs: 1536,
    totalWeightKg: 268.8,
    cartonCount: 16,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'MAR',
    dcPrefix: '08',
    masterPo: '079550',
    partName: 'PART 5',
    productCode: 'A007',
    quantityPcs: 1248,
    totalWeightKg: 218.4,
    cartonCount: 13,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'TJM',
    dcPrefix: '10',
    masterPo: '079567',
    partName: 'PART 1',
    productCode: 'A007',
    quantityPcs: 1920,
    totalWeightKg: 336.0,
    cartonCount: 20,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'TJM',
    dcPrefix: '40',
    masterPo: '079567',
    partName: 'PART 2',
    productCode: 'A007',
    quantityPcs: 2112,
    totalWeightKg: 369.6,
    cartonCount: 22,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'TJM',
    dcPrefix: '60',
    masterPo: '079567',
    partName: 'PART 3',
    productCode: 'A007',
    quantityPcs: 1536,
    totalWeightKg: 268.8,
    cartonCount: 16,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'TJM',
    dcPrefix: '70',
    masterPo: '079567',
    partName: 'PART 4',
    productCode: 'A007',
    quantityPcs: 2688,
    totalWeightKg: 470.4,
    cartonCount: 28,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
  {
    divisionCode: 'TJM',
    dcPrefix: '80',
    masterPo: '079567',
    partName: 'PART 5',
    productCode: 'A007',
    quantityPcs: 2112,
    totalWeightKg: 369.6,
    cartonCount: 22,
    cartonLengthCm: 61,
    cartonWidthCm: 51,
    cartonHeightCm: 27,
  },
];

const EXPECTED = {
  cartonCount: SAMPLE_PARTS.reduce((s, p) => s + p.cartonCount, 0),
  quantityPcs: SAMPLE_PARTS.reduce((s, p) => s + p.quantityPcs, 0),
  totalWeightKg: Math.round(SAMPLE_PARTS.reduce((s, p) => s + p.totalWeightKg, 0) * 10) / 10,
  totalCbm:
    Math.round(
      SAMPLE_PARTS.reduce(
        (s, p) =>
          s +
          (p.cartonLengthCm *
            10 *
            (p.cartonWidthCm * 10) *
            (p.cartonHeightCm * 10) *
            p.cartonCount) /
            1_000_000_000,
        0,
      ) * 1e6,
    ) / 1e6,
};

export async function seedSampleOrder(dataSource: DataSource): Promise<void> {
  const orderRepo = dataSource.getRepository(Order);
  const partRepo = dataSource.getRepository(Part);
  const divisionRepo = dataSource.getRepository(Division);
  const dcPrefixRepo = dataSource.getRepository(DcPrefix);

  const existing = await orderRepo.findOne({ where: { orderNumber: 'KH183' } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('  sample order KH183 already exists — skipping');
    return;
  }

  const order = await orderRepo.save(
    orderRepo.create({ orderNumber: 'KH183', name: 'Đơn mẫu KH183', division: 'PAV', destination: 'USA' }),
  );

  let colorCursor = 0;
  for (const p of SAMPLE_PARTS) {
    const division = await divisionRepo.findOneOrFail({ where: { code: p.divisionCode } });
    const dcPrefix = await dcPrefixRepo.findOneOrFail({
      where: { divisionId: division.id, code: p.dcPrefix },
    });
    const lengthMm = p.cartonLengthCm * 10;
    const widthMm = p.cartonWidthCm * 10;
    const heightMm = p.cartonHeightCm * 10;
    const cbm = (lengthMm * widthMm * heightMm * p.cartonCount) / 1_000_000_000;

    await partRepo.save(
      partRepo.create({
        orderId: order.id,
        partName: p.partName,
        productCode: p.productCode,
        divisionId: division.id,
        dcPrefixId: dcPrefix.id,
        masterPo: p.masterPo,
        quantityPcs: p.quantityPcs,
        totalWeightKg: p.totalWeightKg.toString(),
        cartonCount: p.cartonCount,
        cartonLengthMm: lengthMm,
        cartonWidthMm: widthMm,
        cartonHeightMm: heightMm,
        cbm: cbm.toFixed(6),
        containerId: null,
        colorHex: nextPartColor(colorCursor++),
        // Trường Oracle (Khâu 2): số lô theo mã hàng để liên kết với Khâu 1, 4, 5
        lotNumber: p.productCode === 'A009' ? 'LOT-2026-001' : 'LOT-2026-002',
        uomCode: 'EA',
        unitCost: p.productCode === 'A009' ? '12.50' : '8.75',
        expirationDate: p.productCode === 'A009' ? '2027-12-31' : null,
        supplierName: p.productCode === 'A009' ? 'Nhà cung cấp A' : 'Nhà cung cấp B',
        supplierId: p.productCode === 'A009' ? 1001 : 1002,
        supplierSiteCode: p.productCode === 'A009' ? 'HN-01' : 'HP-02',
      }),
    );
  }

  // Regression guard: if the cm->mm unit contract or the CBM formula ever
  // drifts, this seed fails loudly instead of quietly overfilling containers.
  const actual = await partRepo
    .createQueryBuilder('p')
    .select('SUM(p.carton_count)', 'cartonCount')
    .addSelect('SUM(p.quantity_pcs)', 'quantityPcs')
    .addSelect('SUM(p.total_weight_kg)', 'totalWeightKg')
    .addSelect('SUM(p.cbm)', 'totalCbm')
    .where('p.order_id = :id', { id: order.id })
    .getRawOne<{
      cartonCount: string;
      quantityPcs: string;
      totalWeightKg: string;
      totalCbm: string;
    }>();

  const actualCartonCount = Number(actual?.cartonCount);
  const actualQuantityPcs = Number(actual?.quantityPcs);
  const actualTotalWeightKg = Number(actual?.totalWeightKg);
  const actualTotalCbm = Number(actual?.totalCbm);

  if (
    actualCartonCount !== EXPECTED.cartonCount ||
    actualQuantityPcs !== EXPECTED.quantityPcs ||
    Math.abs(actualTotalWeightKg - EXPECTED.totalWeightKg) > 0.01 ||
    Math.abs(actualTotalCbm - EXPECTED.totalCbm) > 1e-6
  ) {
    throw new Error(
      `Sample order seed integrity check failed. Expected ${JSON.stringify(EXPECTED)}, got ` +
        `{cartonCount:${actualCartonCount}, quantityPcs:${actualQuantityPcs}, totalWeightKg:${actualTotalWeightKg}, totalCbm:${actualTotalCbm}}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `  sample order KH183 seeded: ${SAMPLE_PARTS.length} parts, ${EXPECTED.cartonCount} cartons, ${EXPECTED.totalCbm} m3`,
  );
}
