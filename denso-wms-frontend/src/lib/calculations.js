import { RACK_SPEC } from '@/lib/viz/rackLayout';

const viNumber = new Intl.NumberFormat('vi-VN');

export function calcCartonCbm(length, width, height) {
  return (length * width * height) / 1_000_000;
}

export function calcPartCbm(part) {
  if (!part) return 0;
  return calcCartonCbm(part.cartonLength, part.cartonWidth, part.cartonHeight) * part.cartons;
}

export function calcRackStats(parts, rack) {
  const assigned = parts.filter((p) => p.rackId === rack.id);
  const totalCbm = assigned.reduce((s, p) => s + calcPartCbm(p), 0);
  const totalWeight = assigned.reduce((s, p) => s + (p.weight || 0), 0);
  const totalCartons = assigned.reduce((s, p) => s + (p.cartons || 0), 0);
  const totalQty = assigned.reduce((s, p) => s + (p.quantity || 0), 0);
  const cbmPct = rack.maxCbm ? (totalCbm / rack.maxCbm) * 100 : 0;
  const weightPct = rack.maxWeight ? (totalWeight / rack.maxWeight) * 100 : 0;
  return { parts: assigned, totalCbm, totalWeight, totalCartons, totalQty, cbmPct, weightPct, partCount: assigned.length };
}

export function calcMaxCartonsFit(cartonL, cartonW, cartonH) {
  const slotW = RACK_SPEC.bayWidthMm / 10;
  const slotD = RACK_SPEC.depthMm / 10;
  const slotH = (RACK_SPEC.levelHeightMm - RACK_SPEC.shelfThicknessMm) / 10;
  const o1 = Math.floor(slotW / cartonL) * Math.floor(slotD / cartonW);
  const o2 = Math.floor(slotW / cartonW) * Math.floor(slotD / cartonL);
  const perLayer = Math.max(o1, o2);
  const layers = Math.floor(slotH / cartonH);
  return { perLayer, layers, total: perLayer * layers };
}

export function fmtNum(n) { return viNumber.format(Math.round(n || 0)); }
export function fmtDec(n, d = 2) { return viNumber.format(Number(n || 0).toFixed(d)); }
export function fmtKg(n) { return `${viNumber.format(Number(n || 0).toFixed(1))} kg`; }
export function fmtCbm(n) { return `${viNumber.format(Number(n || 0).toFixed(3))} m³`; }

export function utilColor(pct) {
  if (pct > 100) return { bg: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-200' };
  if (pct >= 85) return { bg: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-200' };
  if (pct >= 50) return { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-200' };
  return { bg: 'bg-indigo-500', text: 'text-indigo-600', ring: 'ring-indigo-200' };
}
