import { DataSource } from 'typeorm';
import { DcPrefix } from '../../divisions/entities/dc-prefix.entity';
import { Division } from '../../divisions/entities/division.entity';

// TJX loading sequence: HomeGoods -> Marshalls -> TJ Maxx. Prefixes are the
// first 2 digits of the PO (kept as zero-padded strings — never numbers).
export const DIVISION_SEED = [
  {
    code: 'HG',
    name: 'HomeGoods',
    sortOrder: 1,
    colorHex: '#6366f1',
    prefixes: ['10', '20', '30', '40', '50', '60', '70', '90'],
  },
  {
    code: 'MAR',
    name: 'Marshalls',
    sortOrder: 2,
    colorHex: '#10b981',
    prefixes: ['01', '04', '06', '07', '08'],
  },
  {
    code: 'TJM',
    name: 'TJ Maxx',
    sortOrder: 3,
    colorHex: '#f59e0b',
    prefixes: ['10', '40', '60', '70', '80'],
  },
];

export async function seedDivisions(dataSource: DataSource): Promise<void> {
  const divisionRepo = dataSource.getRepository(Division);
  const dcPrefixRepo = dataSource.getRepository(DcPrefix);

  for (const d of DIVISION_SEED) {
    let division = await divisionRepo.findOne({ where: { code: d.code } });
    if (!division) {
      division = await divisionRepo.save(
        divisionRepo.create({
          code: d.code,
          name: d.name,
          sortOrder: d.sortOrder,
          colorHex: d.colorHex,
        }),
      );
    }

    for (const [index, prefix] of d.prefixes.entries()) {
      if (!/^\d{2}$/.test(prefix)) {
        throw new Error(`Invalid DC prefix "${prefix}" for division ${d.code} — must be 2 digits`);
      }
      const existing = await dcPrefixRepo.findOne({
        where: { divisionId: division.id, code: prefix },
      });
      if (!existing) {
        await dcPrefixRepo.save(
          dcPrefixRepo.create({ divisionId: division.id, code: prefix, sortOrder: index }),
        );
      }
    }
  }

  // Leading-zero regression guard: MAR's prefixes must read back as '01' not '1'.
  const mar = await divisionRepo.findOneOrFail({ where: { code: 'MAR' } });
  const marPrefixes = await dcPrefixRepo.find({
    where: { divisionId: mar.id },
    order: { sortOrder: 'ASC' },
  });
  const codes = marPrefixes.map((p) => p.code).join(',');
  if (codes !== '01,04,06,07,08') {
    throw new Error(
      `Seed integrity check failed: MAR dc_prefixes = "${codes}", expected "01,04,06,07,08"`,
    );
  }
  // eslint-disable-next-line no-console
  console.log('  divisions + dc_prefixes seeded (leading-zero check OK)');
}
