export const RACK_SPEC = {
  bays: 5,
  levels: 4,
  slotCount: 20,
  bayWidthMm: 1300,
  levelHeightMm: 750,
  depthMm: 900,
  frameThicknessMm: 55,
  shelfThicknessMm: 28,
};

function orientationFor(p) {
  const candidates = [
    { w: p.dxMm, d: p.dyMm, h: p.dzMm, rotated: false },
    { w: p.dyMm, d: p.dxMm, h: p.dzMm, rotated: true },
  ];

  const scored = candidates.map((o) => {
    const nx = Math.floor(RACK_SPEC.bayWidthMm / o.w);
    const nz = Math.floor(RACK_SPEC.depthMm / o.d);
    const ny = Math.floor(RACK_SPEC.levelHeightMm / o.h);
    return { ...o, nx, nz, ny, capacity: Math.max(0, nx * nz * ny) };
  });

  scored.sort((a, b) => b.capacity - a.capacity);
  return scored[0];
}


function sourceAlreadyUsesRackCoordinates(sourcePlacements) {
  if (!sourcePlacements.length) return false;
  return sourcePlacements.every(
    (p) => p.wallIndex >= 1 && p.wallIndex <= RACK_SPEC.bays && p.layer >= 1 && p.layer <= RACK_SPEC.levels,
  );
}

function fromRackCoordinates(sourcePlacements) {
  const slots = Array.from({ length: RACK_SPEC.slotCount }, (_, index) => ({
    index,
    code: `S${String(index + 1).padStart(2, '0')}`,
    bay: (index % RACK_SPEC.bays) + 1,
    level: Math.floor(index / RACK_SPEC.bays) + 1,
    placements: [],
  }));

  const placements = sourcePlacements.map((p) => {
    const slotIndex = (p.layer - 1) * RACK_SPEC.bays + (p.wallIndex - 1);
    const slot = slots[slotIndex];
    const mapped = {
      ...p,
      rackSlotIndex: slotIndex,
      rackSlotCode: slot.code,
      rackBay: p.wallIndex,
      rackLevel: p.layer,
    };
    slot.placements.push(mapped);
    return mapped;
  });

  return {
    placements,
    slots,
    usedSlots: slots.filter((s) => s.placements.length > 0).length,
    overflowCartons: 0,
    spec: RACK_SPEC,
  };
}

export function buildRackLayout(sourcePlacements = []) {
  if (sourceAlreadyUsesRackCoordinates(sourcePlacements)) {
    return fromRackCoordinates(sourcePlacements);
  }
  const groups = [];
  const byPart = new Map();

  for (const p of sourcePlacements) {
    if (!byPart.has(p.partId)) {
      const g = { partId: p.partId, items: [] };
      byPart.set(p.partId, g);
      groups.push(g);
    }
    byPart.get(p.partId).items.push(p);
  }

  const placements = [];
  const slots = Array.from({ length: RACK_SPEC.slotCount }, (_, index) => ({
    index,
    code: `S${String(index + 1).padStart(2, '0')}`,
    bay: (index % RACK_SPEC.bays) + 1,
    level: Math.floor(index / RACK_SPEC.bays) + 1,
    placements: [],
  }));

  let slotIndex = 0;
  let overflowCartons = 0;

  for (const group of groups) {
    let itemCursor = 0;
    while (itemCursor < group.items.length) {
      if (slotIndex >= slots.length) {
        overflowCartons += group.items.length - itemCursor;
        break;
      }

      const sample = group.items[itemCursor];
      const o = orientationFor(sample);
      if (!o.capacity) {
        overflowCartons += group.items.length - itemCursor;
        break;
      }

      const slot = slots[slotIndex];
      const take = Math.min(o.capacity, group.items.length - itemCursor);
      const bay0 = slot.bay - 1;
      const level0 = slot.level - 1;

      for (let i = 0; i < take; i += 1) {
        const src = group.items[itemCursor + i];
        const ix = i % o.nx;
        const iz = Math.floor(i / o.nx) % o.nz;
        const iy = Math.floor(i / (o.nx * o.nz));

        const xMm = bay0 * RACK_SPEC.bayWidthMm + ix * o.w + 18;
        const yMm = iz * o.d + 18;
        const zMm = level0 * RACK_SPEC.levelHeightMm + iy * o.h + RACK_SPEC.shelfThicknessMm;

        const mapped = {
          ...src,
          rackSlotIndex: slot.index,
          rackSlotCode: slot.code,
          rackBay: slot.bay,
          rackLevel: slot.level,
          xMm,
          yMm,
          zMm,
          dxMm: o.w,
          dyMm: o.d,
          dzMm: o.h,
          rotated: o.rotated,
          layer: slot.level,
          wallIndex: slot.bay,
          column: i + 1,
        };

        slot.placements.push(mapped);
        placements.push(mapped);
      }

      itemCursor += take;
      slotIndex += 1;
    }
  }

  return {
    placements,
    slots,
    usedSlots: slots.filter((s) => s.placements.length > 0).length,
    overflowCartons,
    spec: RACK_SPEC,
  };
}
