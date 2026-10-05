import { DEFAULT_SOLVER_CONFIG, SolverConfig } from '../domain/config';
import { BlockSummary, ContainerDims, SolveResult, SolverPart, Violation } from '../domain/types';
import { sortPartsForLoading } from './ordering';
import { cartonFitsRackSlot, packWarehouseRack, WAREHOUSE_RACK } from './rack-packer';

export function solve(
  parts: SolverPart[],
  container: ContainerDims,
  _config: SolverConfig = DEFAULT_SOLVER_CONFIG,
): SolveResult {
  const sorted = sortPartsForLoading(parts);
  const violations: Violation[] = [];
  const packed = packWarehouseRack(sorted);
  const allPlacements = packed.placements;

  const blocks: BlockSummary[] = sorted.map((part) => {
    const placedForPart = allPlacements.filter((placement) => placement.partId === part.id);
    const unplacedCartons = packed.unplacedByPart[part.id] ?? 0;

    const cartonWeightKg = part.cartonCount > 0 ? part.totalWeightKg / part.cartonCount : 0;
    if (unplacedCartons === part.cartonCount && !cartonFitsRackSlot(part)) {
      violations.push({
        code: 'CARTON_TOO_LARGE_FOR_RACK_SLOT',
        severity: 'error',
        message: `PART ${part.partName}: kích thước thùng không vừa một ô kệ tiêu chuẩn`,
        partId: part.id,
      });
    } else if (unplacedCartons === part.cartonCount && cartonWeightKg > WAREHOUSE_RACK.maxWeightPerSlotKg) {
      violations.push({
        code: 'CARTON_TOO_HEAVY_FOR_RACK_SLOT',
        severity: 'error',
        message: `PART ${part.partName}: mỗi thùng ${cartonWeightKg.toFixed(1)} kg vượt giới hạn ${WAREHOUSE_RACK.maxWeightPerSlotKg} kg/ô`,
        partId: part.id,
      });
    } else if (unplacedCartons > 0) {
      violations.push({
        code: 'RACK_CAPACITY_EXCEEDED',
        severity: 'error',
        message: `PART ${part.partName}: còn ${unplacedCartons}/${part.cartonCount} thùng chưa có vị trí do hết ô hoặc chạm giới hạn tải trọng`,
        partId: part.id,
      });
    }

    const touchedBays = placedForPart.map((placement) => placement.wallIndex);
    return {
      partId: part.id,
      partName: part.partName,
      divisionCode: part.divisionCode,
      dcPrefixCode: part.dcPrefixCode,
      masterPo: part.masterPo,
      colorHex: part.colorHex,
      cartonCount: part.cartonCount,
      placedCartonCount: part.cartonCount - unplacedCartons,
      wallStart: touchedBays.length ? Math.min(...touchedBays) : 0,
      wallEnd: touchedBays.length ? Math.max(...touchedBays) : 0,
    };
  });

  addRackSafetyWarnings(violations, packed.slotWeightsKg, packed.levelWeightsKg, packed.rackWeightKg);

  const cbmUsed = sumPlacedCbm(allPlacements);
  const weightUsedKg = sumPlacedWeight(sorted, packed.unplacedByPart);

  // Keep configurable capacity guards as an additional safety net.
  if (cbmUsed > container.maxCbm) {
    violations.push({
      code: 'CBM_EXCEEDED',
      severity: 'error',
      message: `Tổng CBM đã xếp (${cbmUsed.toFixed(3)} m³) vượt giới hạn cấu hình (${container.maxCbm} m³)`,
    });
  }
  if (weightUsedKg > container.maxPayloadKg) {
    violations.push({
      code: 'WEIGHT_EXCEEDED',
      severity: 'error',
      message: `Tổng trọng lượng đã xếp (${weightUsedKg.toFixed(1)} kg) vượt giới hạn tải (${container.maxPayloadKg} kg)`,
    });
  }

  return {
    placements: allPlacements,
    blocks,
    violations,
    wallCount: Math.max(0, ...allPlacements.map((placement) => placement.wallIndex)),
    layerCount: Math.max(0, ...allPlacements.map((placement) => placement.layer)),
    cbmUsed,
    weightUsedKg,
  };
}

function addRackSafetyWarnings(
  violations: Violation[],
  slotWeightsKg: number[],
  levelWeightsKg: number[],
  rackWeightKg: number,
): void {
  const threshold = WAREHOUSE_RACK.nearFullRatio;

  slotWeightsKg.forEach((weight, index) => {
    if (weight > WAREHOUSE_RACK.maxWeightPerSlotKg) {
      violations.push({
        code: 'SLOT_OVERLOAD',
        severity: 'error',
        message: `Ô S${String(index + 1).padStart(2, '0')}: ${weight.toFixed(1)} kg vượt giới hạn ${WAREHOUSE_RACK.maxWeightPerSlotKg} kg`,
      });
    } else if (weight >= WAREHOUSE_RACK.maxWeightPerSlotKg * threshold) {
      violations.push({
        code: 'SLOT_NEAR_FULL',
        severity: 'warning',
        message: `Ô S${String(index + 1).padStart(2, '0')}: ${weight.toFixed(1)}/${WAREHOUSE_RACK.maxWeightPerSlotKg} kg — gần đầy tải trọng`,
      });
    }
  });

  levelWeightsKg.forEach((weight, index) => {
    if (weight > WAREHOUSE_RACK.maxWeightPerLevelKg) {
      violations.push({
        code: 'LEVEL_OVERLOAD',
        severity: 'error',
        message: `Tầng ${index + 1}: ${weight.toFixed(1)} kg vượt giới hạn ${WAREHOUSE_RACK.maxWeightPerLevelKg} kg`,
      });
    } else if (weight >= WAREHOUSE_RACK.maxWeightPerLevelKg * threshold) {
      violations.push({
        code: 'LEVEL_NEAR_FULL',
        severity: 'warning',
        message: `Tầng ${index + 1}: ${weight.toFixed(1)}/${WAREHOUSE_RACK.maxWeightPerLevelKg} kg — gần đầy tải trọng`,
      });
    }
  });

  if (rackWeightKg > WAREHOUSE_RACK.maxWeightRackKg) {
    violations.push({
      code: 'RACK_OVERLOAD',
      severity: 'error',
      message: `Kệ: ${rackWeightKg.toFixed(1)} kg vượt giới hạn ${WAREHOUSE_RACK.maxWeightRackKg} kg`,
    });
  } else if (rackWeightKg >= WAREHOUSE_RACK.maxWeightRackKg * threshold) {
    violations.push({
      code: 'RACK_NEAR_FULL',
      severity: 'warning',
      message: `Kệ: ${rackWeightKg.toFixed(1)}/${WAREHOUSE_RACK.maxWeightRackKg} kg — gần đầy tải trọng`,
    });
  }
}

function sumPlacedCbm(placements: SolveResult['placements']): number {
  return placements.reduce(
    (sum, placement) => sum + (placement.dxMm * placement.dyMm * placement.dzMm) / 1_000_000_000,
    0,
  );
}

function sumPlacedWeight(parts: SolverPart[], unplacedByPart: Record<string, number>): number {
  return parts.reduce((sum, part) => {
    const placedCount = part.cartonCount - (unplacedByPart[part.id] ?? 0);
    return sum + (part.totalWeightKg * placedCount) / part.cartonCount;
  }, 0);
}
