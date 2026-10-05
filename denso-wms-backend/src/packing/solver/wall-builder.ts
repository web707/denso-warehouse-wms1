import { SolverConfig } from '../domain/config';
import { ContainerDims, PlacementDraft, SolverPart } from '../domain/types';
import { chooseOrientation } from './orientation';

// A physical "carton wall": a full-width slab at a fixed x position, filled
// bottom-to-top, column-by-column. Left open (kept around) whenever a part
// doesn't have enough cartons to fill it all the way to the ceiling, so a
// later part in the same Division can backfill the leftover headroom
// instead of it going to waste.
export interface WallSlot {
  wallIndex: number;
  xStart: number;
  ox: number;
  oy: number;
  cartonHeightMm: number;
  colsPerWall: number;
  layersPerWall: number;
  filledCells: number; // 0..colsPerWall*layersPerWall, raster order (layer-major, column-minor)
}

export interface WallBuilderState {
  openSlots: WallSlot[]; // still-short-of-the-ceiling walls, scoped to the current Division
  lastWallEnd: number; // x position (mm) where the next brand-new wall starts
  nextWallIndex: number;
}

export interface WallBuildResult {
  placements: PlacementDraft[];
  wallsOpened: number;
  unplacedCartons: number;
  cartonDoesNotFit: boolean;
  state: WallBuilderState; // updated state to pass into the next part
}

/**
 * Lays out one PART as a sequence of "carton walls": full-height,
 * full-width slabs of thickness = the chosen carton orientation's x-extent,
 * stacked back-to-back along the container's length. Each wall fills
 * layer-by-layer (bottom to top), and within a layer column-by-column
 * (across the container's width) — this is what Layer/Row/Column in the
 * coordinate table map to (Row = wall index, Column = position within a
 * layer).
 *
 * Vertical backfill ("chiều cao ghi đè" — client-approved trade-off, see
 * solve.ts): a wall a PREVIOUS part in this Division left short of the
 * ceiling (too few cartons to reach the top) stays registered in
 * `state.openSlots`. Any LATER part in the SAME Division whose carton
 * footprint (length x width x height, after orientation) matches EXACTLY
 * fills that leftover headroom first — even if it isn't the very next part
 * in Division/DC Prefix/Master PO order — before any new wall opens. This
 * can shuffle retrieval order WITHIN a single wall (a later-PO carton ends
 * up under an earlier-PO one in the same stack), but never moves an
 * already-placed carton's x position, and a wall's x position is still
 * assigned strictly in the order walls are first opened. Sharing never
 * crosses a Division boundary — the caller (solve.ts) resets `openSlots`
 * whenever the Division changes, so each Division stays a contiguous zone.
 */
export function buildWallsForPart(
  part: SolverPart,
  container: ContainerDims,
  state: WallBuilderState,
  blockIndex: number,
  spillOverPolicy: SolverConfig['spillOverPolicy'] = 'adjacent',
): WallBuildResult {
  const { ox, oy, rotated } = chooseOrientation(
    part.cartonLengthMm,
    part.cartonWidthMm,
    container.internalWidthMm,
  );
  const colsPerWall = Math.floor(container.internalWidthMm / oy);
  const layersPerWall = Math.floor(container.internalHeightMm / part.cartonHeightMm);

  if (colsPerWall === 0 || layersPerWall === 0) {
    return {
      placements: [],
      wallsOpened: 0,
      unplacedCartons: part.cartonCount,
      cartonDoesNotFit: true,
      state,
    };
  }

  const placements: PlacementDraft[] = [];
  const openSlots = state.openSlots.slice();
  let remaining = part.cartonCount;
  let cartonSeq = 0;
  let wallsOpened = 0;
  let nextWallIndex = state.nextWallIndex;
  let lastWallEnd = state.lastWallEnd;

  const placeInSlot = (slot: WallSlot) => {
    const capacity = slot.colsPerWall * slot.layersPerWall;
    const cartonsHere = Math.min(remaining, capacity - slot.filledCells);
    for (let i = 0; i < cartonsHere; i++) {
      const cellIndex = slot.filledCells + i;
      const layer = Math.floor(cellIndex / slot.colsPerWall) + 1;
      const col = (cellIndex % slot.colsPerWall) + 1;
      placements.push({
        partId: part.id,
        blockIndex,
        cartonSeq: cartonSeq++,
        wallIndex: slot.wallIndex,
        layer,
        column: col,
        xMm: slot.xStart,
        yMm: (col - 1) * slot.oy,
        zMm: (layer - 1) * slot.cartonHeightMm,
        dxMm: slot.ox,
        dyMm: slot.oy,
        dzMm: slot.cartonHeightMm,
        rotated,
        colorHex: part.colorHex,
      });
    }
    slot.filledCells += cartonsHere;
    remaining -= cartonsHere;
  };

  if (spillOverPolicy === 'adjacent') {
    for (const slot of openSlots) {
      if (remaining <= 0) break;
      const capacity = slot.colsPerWall * slot.layersPerWall;
      const isMatch =
        slot.ox === ox && slot.oy === oy && slot.cartonHeightMm === part.cartonHeightMm;
      if (isMatch && slot.filledCells < capacity) placeInSlot(slot);
    }
  }
  for (let i = openSlots.length - 1; i >= 0; i--) {
    if (openSlots[i].filledCells >= openSlots[i].colsPerWall * openSlots[i].layersPerWall) {
      openSlots.splice(i, 1);
    }
  }

  while (remaining > 0) {
    const xStart = lastWallEnd;
    if (xStart + ox > container.internalLengthMm) break; // out of container length
    const slot: WallSlot = {
      wallIndex: nextWallIndex,
      xStart,
      ox,
      oy,
      cartonHeightMm: part.cartonHeightMm,
      colsPerWall,
      layersPerWall,
      filledCells: 0,
    };
    nextWallIndex += 1;
    wallsOpened += 1;
    placeInSlot(slot);
    lastWallEnd = xStart + ox;
    if (slot.filledCells < slot.colsPerWall * slot.layersPerWall) {
      openSlots.push(slot);
    }
  }

  return {
    placements,
    wallsOpened,
    unplacedCartons: remaining,
    cartonDoesNotFit: false,
    state: { openSlots, lastWallEnd, nextWallIndex },
  };
}
