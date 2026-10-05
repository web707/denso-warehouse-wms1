import { DataSource } from 'typeorm';
import { ContainerType } from '../../container-types/entities/container-type.entity';

// Backward-compatible repository/entity names are kept internally, but these
// rows represent industrial warehouse racks: 5 bays × 4 levels = 20 slots.
const rackTypes: Partial<ContainerType>[] = [
  {
    code: 'RACK20-A',
    label: 'Kệ công nghiệp 20 ô - Khu A',
    internalLengthMm: 6500,
    internalWidthMm: 900,
    internalHeightMm: 3000,
    doorWidthMm: null,
    doorHeightMm: null,
    maxCbm: '17.550',
    maxPayloadKg: '10000.00',
    tareWeightKg: null,
  },
  {
    code: 'RACK20-B',
    label: 'Kệ công nghiệp 20 ô - Khu B',
    internalLengthMm: 6500,
    internalWidthMm: 900,
    internalHeightMm: 3000,
    doorWidthMm: null,
    doorHeightMm: null,
    maxCbm: '17.550',
    maxPayloadKg: '10000.00',
    tareWeightKg: null,
  },
  {
    code: 'RACK20-C',
    label: 'Kệ công nghiệp 20 ô - Khu C',
    internalLengthMm: 6500,
    internalWidthMm: 900,
    internalHeightMm: 3000,
    doorWidthMm: null,
    doorHeightMm: null,
    maxCbm: '17.550',
    maxPayloadKg: '10000.00',
    tareWeightKg: null,
  },
  {
    code: 'RACK20-D',
    label: 'Kệ công nghiệp 20 ô - Khu D',
    internalLengthMm: 6500,
    internalWidthMm: 900,
    internalHeightMm: 3000,
    doorWidthMm: null,
    doorHeightMm: null,
    maxCbm: '17.550',
    maxPayloadKg: '10000.00',
    tareWeightKg: null,
  },
];

export async function seedContainerTypes(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(ContainerType);
  for (const data of rackTypes) {
    const existing = await repo.findOne({ where: { code: data.code! } });
    if (existing) await repo.save(repo.merge(existing, data));
    else await repo.save(repo.create(data));
  }
  console.log('  rack storage types seeded (4 × 20-slot industrial racks)');
}
