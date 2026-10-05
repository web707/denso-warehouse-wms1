// Placements come from the backend in millimetres; three.js scenes read
// far more naturally in metres (camera near/far, controls speed, etc.).
export const mmToM = (mm) => mm / 1000;

export function boundsOf(placements) {
  if (!placements.length) return { lengthMm: 0, widthMm: 0, heightMm: 0 };
  return {
    lengthMm: Math.max(...placements.map((p) => p.xMm + p.dxMm)),
    widthMm: Math.max(...placements.map((p) => p.yMm + p.dyMm)),
    heightMm: Math.max(...placements.map((p) => p.zMm + p.dzMm)),
  };
}

export function groupByLayer(placements) {
  const map = new Map();
  for (const p of placements) {
    if (!map.has(p.layer)) map.set(p.layer, []);
    map.get(p.layer).push(p);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export function layerCountOf(placements) {
  return placements.reduce((max, p) => Math.max(max, p.layer), 0);
}

export function fmtLayer(n) {
  return `L${String(n).padStart(2, '0')}`;
}

export function fmtRow(n) {
  return `R${String(n).padStart(2, '0')}`;
}

export function fmtColumn(n) {
  return `C${String(n).padStart(2, '0')}`;
}

// TJX-style PO label: "{DC Prefix}-{Master PO}" with the Master PO
// zero-padded to 6 digits (e.g. "20-000001") — matches the client's
// Warehouse rack location reference diagram.
export function formatPoLabel(dcPrefix, masterPo) {
  if (!dcPrefix || !masterPo) return '';
  const prefix = String(dcPrefix).trim().padStart(2, '0');
  const po = String(masterPo).trim().replace(/\D/g, '').padStart(6, '0');
  return `${prefix}-${po}`;
}
