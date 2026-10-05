import { ContainerDims, PlacementDraft, SolverPart } from '../domain/types';

interface EmptySpace {
  xMm: number;
  yMm: number;
  zMm: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

interface BoxOrientation {
  dxMm: number;
  dyMm: number;
  dzMm: number;
  rotated: boolean;
}

interface PartCursor {
  part: SolverPart;
  blockIndex: number;
  remaining: number;
  nextCartonSeq: number;
}

interface TypeGroup {
  sample: SolverPart;
  partCursors: PartCursor[];
  remainingCount: number;
  volumeMm3: number;
  footprintMm2: number;
}

interface BlockShape {
  countX: number;
  countY: number;
  countZ: number;
  cartonCount: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

interface BlockCandidate {
  space: EmptySpace;
  spaceIndex: number;
  orientation: BoxOrientation;
  shape: BlockShape;
}

export interface SpacePackResult {
  placements: PlacementDraft[];
  unplacedByPart: Record<string, number>;
}

interface DivisionPackResult extends SpacePackResult {
  usedLengthMm: number;
}

// Packs the whole order as one anonymous pool (grouped only by carton size,
// ignoring division) so block-building can use the entire container instead
// of being boxed into per-division slices. The resulting coordinates are then
// "painted" back onto the real PARTs in strict Division -> DC Prefix ->
// Master PO order, so the logical grouping the client requires still holds
// even though the physical packing no longer partitions space by division
// up front. See docs conversation: this fixes divisions whose cartons share
// an exact size with a neighboring division wasting a container's worth of
// space when packed division-by-division.
export function packGlobalPool(parts: SolverPart[], container: ContainerDims): SpacePackResult {
  const rootSpace: EmptySpace = {
    xMm: 0,
    yMm: 0,
    zMm: 0,
    lengthMm: container.internalLengthMm,
    widthMm: container.internalWidthMm,
    heightMm: packableHeightMm(container),
  };

  const dimsGroups = groupPartsByDims(parts);
  const shadowParts: SolverPart[] = dimsGroups.map((group, index) => ({
    ...group.sample,
    id: `__pool_${index}__`,
    partName: '__pool__',
    cartonCount: group.totalCount,
  }));

  const { placements: pooledPlacements } = packDivision(shadowParts, rootSpace);

  const queueByKey = new Map<string, PlacementDraft[]>();
  dimsGroups.forEach((group, index) => {
    const shadowId = shadowParts[index].id;
    const queue = pooledPlacements
      .filter((placement) => placement.partId === shadowId)
      .sort((a, b) => a.xMm - b.xMm || a.zMm - b.zMm || a.yMm - b.yMm);
    queueByKey.set(group.key, queue);
  });

  const unplacedByPart: Record<string, number> = {};
  const placements: PlacementDraft[] = [];

  parts.forEach((part, blockIndex) => {
    const queue = queueByKey.get(dimsKey(part)) ?? [];
    const taken = queue.splice(0, part.cartonCount);
    taken.forEach((slot, cartonSeq) => {
      placements.push({
        ...slot,
        partId: part.id,
        blockIndex,
        cartonSeq,
        colorHex: part.colorHex,
      });
    });
    unplacedByPart[part.id] = part.cartonCount - taken.length;
  });

  return { placements: addDisplayCoordinates(placements), unplacedByPart };
}

interface DimsGroup {
  key: string;
  sample: SolverPart;
  totalCount: number;
}

function groupPartsByDims(parts: SolverPart[]): DimsGroup[] {
  const groups = new Map<string, DimsGroup>();
  for (const part of parts) {
    const key = dimsKey(part);
    const existing = groups.get(key);
    if (existing) {
      existing.totalCount += part.cartonCount;
    } else {
      groups.set(key, { key, sample: part, totalCount: part.cartonCount });
    }
  }
  return [...groups.values()];
}

function dimsKey(part: SolverPart): string {
  return `${part.cartonLengthMm}:${part.cartonWidthMm}:${part.cartonHeightMm}`;
}

// A container's internal ceiling can sit well above its door opening (common
// on High Cube units). Cargo can only be walked/forklifted in through the
// door, so the door height -- not the internal height -- is the real ceiling
// for stacking.
function packableHeightMm(container: ContainerDims): number {
  if (!container.doorHeightMm) return container.internalHeightMm;
  return Math.min(container.doorHeightMm, container.internalHeightMm);
}

export function packDivisionAware(parts: SolverPart[], container: ContainerDims): SpacePackResult {
  const unplacedByPart = Object.fromEntries(parts.map((part) => [part.id, part.cartonCount]));
  const packed: PlacementDraft[] = [];
  let divisionStartMm = 0;

  for (const divisionParts of groupContiguousDivisions(parts)) {
    const remainingLengthMm = container.internalLengthMm - divisionStartMm;
    if (remainingLengthMm <= 0) break;

    const result = packDivision(divisionParts, {
      xMm: divisionStartMm,
      yMm: 0,
      zMm: 0,
      lengthMm: remainingLengthMm,
      widthMm: container.internalWidthMm,
      heightMm: packableHeightMm(container),
    });

    packed.push(...result.placements);
    divisionStartMm += result.usedLengthMm;
    Object.assign(unplacedByPart, result.unplacedByPart);
  }

  return { placements: addDisplayCoordinates(packed), unplacedByPart };
}

function packDivision(parts: SolverPart[], rootSpace: EmptySpace): DivisionPackResult {
  const groups = buildTypeGroups(parts);
  const placements: PlacementDraft[] = [];
  let usedLengthMm = 0;
  let spaces: EmptySpace[] = [rootSpace];

  for (const group of groups) {
    while (group.remainingCount > 0) {
      const candidate = findBestBlockCandidate(group, spaces);
      if (!candidate) break;

      placements.push(...materializeBlock(candidate, group));
      usedLengthMm = Math.max(
        usedLengthMm,
        candidate.space.xMm + candidate.shape.lengthMm - rootSpace.xMm,
      );

      spaces.splice(candidate.spaceIndex, 1);
      spaces.push(...splitSpace(candidate));
      spaces = spaces.filter(hasPositiveVolume).sort(compareSpaces);
    }
  }

  const unplacedByPart: Record<string, number> = {};
  for (const group of groups) {
    for (const cursor of group.partCursors) {
      unplacedByPart[cursor.part.id] = cursor.remaining;
    }
  }

  return { placements, unplacedByPart, usedLengthMm };
}

function buildTypeGroups(parts: SolverPart[]): TypeGroup[] {
  const groups = new Map<string, TypeGroup>();

  parts.forEach((part, blockIndex) => {
    const key = dimsKey(part);
    const existing = groups.get(key);
    if (existing) {
      existing.partCursors.push({
        part,
        blockIndex,
        remaining: part.cartonCount,
        nextCartonSeq: 0,
      });
      existing.remainingCount += part.cartonCount;
      return;
    }

    groups.set(key, {
      sample: part,
      partCursors: [{ part, blockIndex, remaining: part.cartonCount, nextCartonSeq: 0 }],
      remainingCount: part.cartonCount,
      volumeMm3: part.cartonLengthMm * part.cartonWidthMm * part.cartonHeightMm,
      footprintMm2: part.cartonLengthMm * part.cartonWidthMm,
    });
  });

  return [...groups.values()].sort(
    (a, b) =>
      b.volumeMm3 - a.volumeMm3 ||
      b.footprintMm2 - a.footprintMm2 ||
      b.sample.cartonHeightMm - a.sample.cartonHeightMm,
  );
}

function findBestBlockCandidate(group: TypeGroup, spaces: EmptySpace[]): BlockCandidate | null {
  let best: BlockCandidate | null = null;

  spaces.forEach((space, spaceIndex) => {
    for (const orientation of uniqueOrientations(group.sample)) {
      const shape = buildLargestBlock(space, orientation, group.remainingCount);
      if (!shape) continue;

      const candidate: BlockCandidate = { space, spaceIndex, orientation, shape };
      if (!best || compareCandidates(candidate, best) < 0) best = candidate;
    }
  });

  return best;
}

function buildLargestBlock(
  space: EmptySpace,
  orientation: BoxOrientation,
  remainingCount: number,
): BlockShape | null {
  const maxX = Math.floor(space.lengthMm / orientation.dxMm);
  const maxY = Math.floor(space.widthMm / orientation.dyMm);
  const maxZ = Math.floor(space.heightMm / orientation.dzMm);
  if (maxX < 1 || maxY < 1 || maxZ < 1) return null;

  let best: BlockShape | null = null;
  for (let countX = 1; countX <= maxX; countX += 1) {
    for (let countY = 1; countY <= maxY; countY += 1) {
      for (let countZ = 1; countZ <= maxZ; countZ += 1) {
        const cartonCount = countX * countY * countZ;
        if (cartonCount > remainingCount) continue;

        const candidate: BlockShape = {
          countX,
          countY,
          countZ,
          cartonCount,
          lengthMm: countX * orientation.dxMm,
          widthMm: countY * orientation.dyMm,
          heightMm: countZ * orientation.dzMm,
        };

        if (!best || compareBlockShapes(candidate, best) < 0) best = candidate;
      }
    }
  }

  return best;
}

function materializeBlock(candidate: BlockCandidate, group: TypeGroup): PlacementDraft[] {
  const placements: PlacementDraft[] = [];

  for (let z = 0; z < candidate.shape.countZ; z += 1) {
    for (let y = 0; y < candidate.shape.countY; y += 1) {
      for (let x = 0; x < candidate.shape.countX; x += 1) {
        const owner = takeNextOwner(group);
        if (!owner) return placements;

        placements.push({
          partId: owner.part.id,
          blockIndex: owner.blockIndex,
          cartonSeq: owner.nextCartonSeq,
          wallIndex: 0,
          layer: 0,
          column: 0,
          xMm: candidate.space.xMm + x * candidate.orientation.dxMm,
          yMm: candidate.space.yMm + y * candidate.orientation.dyMm,
          zMm: candidate.space.zMm + z * candidate.orientation.dzMm,
          dxMm: candidate.orientation.dxMm,
          dyMm: candidate.orientation.dyMm,
          dzMm: candidate.orientation.dzMm,
          rotated: candidate.orientation.rotated,
          colorHex: owner.part.colorHex,
        });

        owner.remaining -= 1;
        owner.nextCartonSeq += 1;
        group.remainingCount -= 1;
      }
    }
  }

  return placements;
}

function takeNextOwner(group: TypeGroup): PartCursor | null {
  for (const cursor of group.partCursors) {
    if (cursor.remaining > 0) return cursor;
  }
  return null;
}

function splitSpace(candidate: BlockCandidate): EmptySpace[] {
  const { space, shape } = candidate;

  return [
    {
      xMm: space.xMm,
      yMm: space.yMm,
      zMm: space.zMm + shape.heightMm,
      lengthMm: shape.lengthMm,
      widthMm: shape.widthMm,
      heightMm: space.heightMm - shape.heightMm,
    },
    {
      xMm: space.xMm,
      yMm: space.yMm + shape.widthMm,
      zMm: space.zMm,
      lengthMm: shape.lengthMm,
      widthMm: space.widthMm - shape.widthMm,
      heightMm: space.heightMm,
    },
    {
      xMm: space.xMm + shape.lengthMm,
      yMm: space.yMm,
      zMm: space.zMm,
      lengthMm: space.lengthMm - shape.lengthMm,
      widthMm: space.widthMm,
      heightMm: space.heightMm,
    },
  ];
}

function groupContiguousDivisions(parts: SolverPart[]): SolverPart[][] {
  const groups: SolverPart[][] = [];
  for (const part of parts) {
    const last = groups[groups.length - 1];
    if (!last || last[0].divisionCode !== part.divisionCode) groups.push([part]);
    else last.push(part);
  }
  return groups;
}

function uniqueOrientations(part: SolverPart): BoxOrientation[] {
  const dims = [part.cartonLengthMm, part.cartonWidthMm, part.cartonHeightMm] as const;
  const seen = new Set<string>();
  const orientations: BoxOrientation[] = [];

  for (const [dxMm, dyMm, dzMm] of [
    [dims[0], dims[1], dims[2]],
    [dims[0], dims[2], dims[1]],
    [dims[1], dims[0], dims[2]],
    [dims[1], dims[2], dims[0]],
    [dims[2], dims[0], dims[1]],
    [dims[2], dims[1], dims[0]],
  ]) {
    const key = `${dxMm}:${dyMm}:${dzMm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    orientations.push({
      dxMm,
      dyMm,
      dzMm,
      rotated: dxMm !== dims[0] || dyMm !== dims[1] || dzMm !== dims[2],
    });
  }

  return orientations;
}

function compareBlockShapes(a: BlockShape, b: BlockShape): number {
  return (
    b.cartonCount - a.cartonCount ||
    // Among shapes that pack the same carton count, prefer the SHORTER one.
    // A shorter block leaves more headroom underneath the door-height ceiling
    // for smaller cartons to use, instead of a taller block eating all the
    // way up to the limit and leaving no room for anything else on top.
    a.heightMm - b.heightMm ||
    b.widthMm - a.widthMm ||
    a.lengthMm - b.lengthMm ||
    a.countZ - b.countZ ||
    b.countY - a.countY ||
    a.countX - b.countX
  );
}

function compareCandidates(a: BlockCandidate, b: BlockCandidate): number {
  const shapeOrder = compareBlockShapes(a.shape, b.shape);
  if (shapeOrder !== 0) return shapeOrder;

  return (
    a.space.xMm - b.space.xMm ||
    a.space.zMm - b.space.zMm ||
    a.space.yMm - b.space.yMm ||
    Number(a.orientation.rotated) - Number(b.orientation.rotated)
  );
}

function compareSpaces(a: EmptySpace, b: EmptySpace): number {
  const aVolume = a.lengthMm * a.widthMm * a.heightMm;
  const bVolume = b.lengthMm * b.widthMm * b.heightMm;
  return a.xMm - b.xMm || a.zMm - b.zMm || a.yMm - b.yMm || bVolume - aVolume;
}

function hasPositiveVolume(space: EmptySpace): boolean {
  return space.lengthMm > 0 && space.widthMm > 0 && space.heightMm > 0;
}

function addDisplayCoordinates(placements: PlacementDraft[]): PlacementDraft[] {
  const xStarts = [...new Set(placements.map((placement) => placement.xMm))].sort((a, b) => a - b);
  const yStarts = [...new Set(placements.map((placement) => placement.yMm))].sort((a, b) => a - b);
  const zStarts = [...new Set(placements.map((placement) => placement.zMm))].sort((a, b) => a - b);

  return placements.map((placement) => ({
    ...placement,
    wallIndex: xStarts.indexOf(placement.xMm) + 1,
    layer: zStarts.indexOf(placement.zMm) + 1,
    column: yStarts.indexOf(placement.yMm) + 1,
  }));
}
