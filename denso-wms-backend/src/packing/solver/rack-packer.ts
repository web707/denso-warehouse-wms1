import { PlacementDraft, SolverPart } from '../domain/types';

export const WAREHOUSE_RACK = {
  bays: 5,
  levels: 4,
  slotCount: 20,
  bayWidthMm: 1300,
  depthMm: 900,
  levelHeightMm: 750,
  shelfThicknessMm: 28,
  maxWeightPerSlotKg: 500,
  maxWeightPerLevelKg: 2000,
  maxWeightRackKg: 10000,
  nearFullRatio: 0.8,
} as const;

interface Orientation {
  dxMm: number;
  dyMm: number;
  dzMm: number;
  nx: number;
  ny: number;
  nz: number;
  capacity: number;
  rotated: boolean;
}

export interface RackPackResult {
  placements: PlacementDraft[];
  unplacedByPart: Record<string, number>;
  usedSlots: number;
  slotWeightsKg: number[];
  levelWeightsKg: number[];
  rackWeightKg: number;
}

function bestOrientation(part: SolverPart): Orientation | null {
  const usableHeightMm = WAREHOUSE_RACK.levelHeightMm - WAREHOUSE_RACK.shelfThicknessMm;
  const candidates = [
    {
      dxMm: part.cartonLengthMm,
      dyMm: part.cartonWidthMm,
      dzMm: part.cartonHeightMm,
      rotated: false,
    },
    {
      dxMm: part.cartonWidthMm,
      dyMm: part.cartonLengthMm,
      dzMm: part.cartonHeightMm,
      rotated: true,
    },
  ].map((o) => {
    const nx = Math.floor(WAREHOUSE_RACK.bayWidthMm / o.dxMm);
    const ny = Math.floor(WAREHOUSE_RACK.depthMm / o.dyMm);
    const nz = Math.floor(usableHeightMm / o.dzMm);
    return { ...o, nx, ny, nz, capacity: Math.max(0, nx * ny * nz) };
  });

  candidates.sort((a, b) => b.capacity - a.capacity);
  return candidates[0]?.capacity ? candidates[0] : null;
}

export function cartonFitsRackSlot(part: SolverPart): boolean {
  return !!bestOrientation(part);
}

function perCartonWeight(part: SolverPart): number {
  return part.cartonCount > 0 ? part.totalWeightKg / part.cartonCount : 0;
}

function slotCode(index: number): string {
  return `S${String(index + 1).padStart(2, '0')}`;
}

/**
 * Fixed industrial rack: 5 bays × 4 levels = 20 storage locations.
 *
 * Safety rules for the WMS demo:
 * - one PART owns one slot at a time (a PART may span adjacent slots);
 * - heavy PARTs are sorted first, therefore lower levels are filled first;
 * - a user-selected preferred slot is honoured when it is available;
 * - max 500 kg per slot;
 * - max 2,000 kg per level;
 * - max 10,000 kg for the whole rack.
 */
export function packWarehouseRack(parts: SolverPart[]): RackPackResult {
  const placements: PlacementDraft[] = [];
  const unplacedByPart: Record<string, number> = {};
  const used = new Set<number>();
  const slotWeightsKg = Array.from({ length: WAREHOUSE_RACK.slotCount }, () => 0);
  const levelWeightsKg = Array.from({ length: WAREHOUSE_RACK.levels }, () => 0);
  let rackWeightKg = 0;

  const ordered = parts
    .map((part, originalIndex) => ({ part, originalIndex }))
    .sort(
      (a, b) =>
        perCartonWeight(b.part) - perCartonWeight(a.part) ||
        b.part.totalWeightKg - a.part.totalWeightKg ||
        a.originalIndex - b.originalIndex,
    );

  for (const { part, originalIndex } of ordered) {
    const orientation = bestOrientation(part);
    if (!orientation) {
      unplacedByPart[part.id] = part.cartonCount;
      continue;
    }

    const cartonWeightKg = perCartonWeight(part);
    let remaining = part.cartonCount;
    let cartonSeq = 1;
    const preferred = part.preferredRackSlot;
    const candidates: number[] = [];

    if (
      preferred !== null &&
      preferred !== undefined &&
      preferred >= 0 &&
      preferred < WAREHOUSE_RACK.slotCount &&
      !used.has(preferred)
    ) {
      candidates.push(preferred);
    }
    for (let slot = 0; slot < WAREHOUSE_RACK.slotCount; slot += 1) {
      if (!used.has(slot) && slot !== preferred) candidates.push(slot);
    }

    for (const slotIndex of candidates) {
      if (remaining <= 0) break;

      const levelIndex = Math.floor(slotIndex / WAREHOUSE_RACK.bays);
      const remainingLevelKg = WAREHOUSE_RACK.maxWeightPerLevelKg - levelWeightsKg[levelIndex];
      const remainingRackKg = WAREHOUSE_RACK.maxWeightRackKg - rackWeightKg;
      const permittedWeightKg = Math.max(
        0,
        Math.min(WAREHOUSE_RACK.maxWeightPerSlotKg, remainingLevelKg, remainingRackKg),
      );

      const weightCapacity = cartonWeightKg > 0
        ? Math.floor(permittedWeightKg / cartonWeightKg)
        : orientation.capacity;
      const slotCapacity = Math.min(orientation.capacity, weightCapacity);
      if (slotCapacity < 1) continue;

      const take = Math.min(remaining, slotCapacity);
      const bay = (slotIndex % WAREHOUSE_RACK.bays) + 1;
      const level = levelIndex + 1;
      const bay0 = bay - 1;
      const level0 = level - 1;

      for (let i = 0; i < take; i += 1) {
        const ix = i % orientation.nx;
        const iy = Math.floor(i / orientation.nx) % orientation.ny;
        const iz = Math.floor(i / (orientation.nx * orientation.ny));

        placements.push({
          partId: part.id,
          blockIndex: originalIndex + 1,
          cartonSeq,
          // Persistence fields are reused as warehouse coordinates:
          // wallIndex = bay, layer = rack level, column = carton sequence within slot.
          wallIndex: bay,
          layer: level,
          column: i + 1,
          xMm: bay0 * WAREHOUSE_RACK.bayWidthMm + ix * orientation.dxMm + 18,
          yMm: iy * orientation.dyMm + 18,
          zMm:
            level0 * WAREHOUSE_RACK.levelHeightMm +
            WAREHOUSE_RACK.shelfThicknessMm +
            iz * orientation.dzMm,
          dxMm: orientation.dxMm,
          dyMm: orientation.dyMm,
          dzMm: orientation.dzMm,
          rotated: orientation.rotated,
          colorHex: part.colorHex,
        });
        cartonSeq += 1;
      }

      const loadedKg = cartonWeightKg * take;
      slotWeightsKg[slotIndex] += loadedKg;
      levelWeightsKg[levelIndex] += loadedKg;
      rackWeightKg += loadedKg;
      remaining -= take;
      used.add(slotIndex);
    }

    unplacedByPart[part.id] = remaining;

    if (remaining > 0 && preferred !== null && preferred !== undefined) {
      // Keeping this branch explicit makes debugging a user-requested slot easy.
      void slotCode(preferred);
    }
  }

  return {
    placements,
    unplacedByPart,
    usedSlots: used.size,
    slotWeightsKg,
    levelWeightsKg,
    rackWeightKg,
  };
}
