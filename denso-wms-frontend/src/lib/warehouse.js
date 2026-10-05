import { RACK_SPEC } from '@/lib/viz/rackLayout';
import { RACK_SAFETY } from '@/lib/viz/rackSafety';
import { calcRackStats } from '@/lib/calculations';

/**
 * Nguồn duy nhất cho các quy tắc Zone → Kệ → Ô.
 * Các trang (Dashboard, Racks, Zones, QR, Báo cáo) dùng chung để số liệu luôn khớp nhau.
 */

export const WAREHOUSE_CODE = 'DENSO-WH';
export const DEFAULT_ZONE = 'ZONE-A';
export const RACKS_PER_ZONE = 20;
export const SLOTS_PER_RACK = RACK_SPEC.slotCount;
export const SLOTS_PER_ZONE = RACKS_PER_ZONE * SLOTS_PER_RACK;
export const BAYS = RACK_SPEC.bays;
export const LEVELS = RACK_SPEC.levels;
// Số ô dùng từ mức này trở lên thì kệ được coi là "gần đầy" (80% của 20 ô = 16)
export const NEAR_FULL_SLOTS = Math.ceil(SLOTS_PER_RACK * RACK_SAFETY.nearRatio);

export const zoneOf = (rack) => rack?.zoneCode || DEFAULT_ZONE;

/* ---------- Mã ô: S01–S20 ---------- */

export function slotCode(index) {
  return `S${String(Number(index) + 1).padStart(2, '0')}`;
}

export function parseSlotCode(code) {
  const n = Number(String(code ?? '').replace(/\D/g, ''));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, SLOTS_PER_RACK) - 1 : 0;
}

export function slotPosition(index) {
  return { level: Math.floor(index / BAYS) + 1, bay: (index % BAYS) + 1 };
}

/* ---------- Sắp xếp kệ: R01, R02, ... R10 ---------- */

export function rackNumber(name) {
  const m = String(name || '').match(/(\d+)/);
  return m ? Number(m[1]) : 999;
}

export function compareRacks(a, b) {
  return rackNumber(a.name) - rackNumber(b.name) || String(a.name).localeCompare(String(b.name), 'vi');
}

/* ---------- Số ô đang dùng ---------- */

/**
 * Một kệ: đếm các ô đã gán cố định; nếu chưa gán ô nào thì tạm tính mỗi PART một ô.
 * (Quy tắc này trước đây lặp ở Racks, QR và Zones với kết quả hơi khác nhau.)
 */
export function usedSlotCount(rackParts) {
  const explicit = new Set(
    rackParts.filter((p) => Number.isInteger(p.preferredRackSlot)).map((p) => p.preferredRackSlot),
  );
  const n = explicit.size > 0 ? explicit.size : rackParts.length;
  return Math.min(SLOTS_PER_RACK, n);
}

/* ---------- Trạng thái kệ ---------- */

export const RACK_STATUS_META = {
  empty: { label: 'Trống', color: '#94a3b8', cell: 'bg-slate-100 text-slate-500', swatch: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  active: { label: 'Đang sử dụng', color: '#22c55e', cell: 'bg-emerald-500 text-white', swatch: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  near: { label: 'Gần đầy', color: '#f59e0b', cell: 'bg-amber-500 text-white', swatch: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  full: { label: 'Đầy', color: '#6366f1', cell: 'bg-indigo-500 text-white', swatch: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  overload: { label: 'Quá tải', color: '#ef4444', cell: 'bg-red-500 text-white', swatch: 'bg-red-500', badge: 'bg-red-100 text-red-700 border-red-200' },
};

export const RACK_STATUS_ORDER = ['empty', 'active', 'near', 'full', 'overload'];

export function rackWeightLimit(rack) {
  return Math.min(Number(rack?.maxWeight) || RACK_SAFETY.rackMaxKg, RACK_SAFETY.rackMaxKg);
}

export function rackStatus({ usedSlots, totalWeight, totalCbm, weightLimit, maxCbm }) {
  if ((weightLimit > 0 && totalWeight > weightLimit) || (maxCbm > 0 && totalCbm > maxCbm)) return 'overload';
  if (usedSlots === 0) return 'empty';
  // "Đầy" phải xét trước "gần đầy", nếu không kệ 20/20 ô sẽ luôn bị xếp vào "gần đầy"
  if ((weightLimit > 0 && totalWeight >= weightLimit) || usedSlots >= SLOTS_PER_RACK) return 'full';
  if ((weightLimit > 0 && totalWeight >= weightLimit * RACK_SAFETY.nearRatio) || usedSlots >= NEAR_FULL_SLOTS) return 'near';
  return 'active';
}

export function summarizeRack(rack, parts) {
  const base = calcRackStats(parts, rack);
  const usedSlots = usedSlotCount(base.parts);
  const weightLimit = rackWeightLimit(rack);
  const status = rackStatus({
    usedSlots,
    totalWeight: base.totalWeight,
    totalCbm: base.totalCbm,
    weightLimit,
    maxCbm: Number(rack.maxCbm) || 0,
  });
  return {
    rack,
    ...base,
    usedSlots,
    slotPct: (usedSlots / SLOTS_PER_RACK) * 100,
    loadPct: Math.max(base.cbmPct, base.weightPct),
    status,
  };
}

/* ---------- Zone ---------- */

export function summarizeZone(zoneCode, racks, parts) {
  const zoneRacks = racks.filter((r) => zoneOf(r) === zoneCode).sort(compareRacks);
  const rackSummaries = zoneRacks.map((r) => summarizeRack(r, parts));
  const statusCounts = Object.fromEntries(RACK_STATUS_ORDER.map((s) => [s, 0]));
  rackSummaries.forEach((r) => { statusCounts[r.status] += 1; });
  return {
    zoneCode,
    racks: rackSummaries,
    rackCount: zoneRacks.length,
    usedRacks: rackSummaries.filter((r) => r.usedSlots > 0).length,
    usedSlots: rackSummaries.reduce((s, r) => s + r.usedSlots, 0),
    totalSlots: zoneRacks.length * SLOTS_PER_RACK,
    partCount: rackSummaries.reduce((s, r) => s + r.partCount, 0),
    totalWeight: rackSummaries.reduce((s, r) => s + r.totalWeight, 0),
    totalCbm: rackSummaries.reduce((s, r) => s + r.totalCbm, 0),
    statusCounts,
  };
}

export function summarizeWarehouse(racks, parts) {
  const codes = [...new Set(racks.map(zoneOf))].sort();
  const zones = codes.map((code) => summarizeZone(code, racks, parts));
  const allRacks = zones.flatMap((z) => z.racks);
  const statusCounts = Object.fromEntries(RACK_STATUS_ORDER.map((s) => [s, 0]));
  allRacks.forEach((r) => { statusCounts[r.status] += 1; });
  const rackIds = new Set(racks.map((r) => r.id));
  return {
    zones,
    racks: allRacks,
    statusCounts,
    usedSlots: zones.reduce((s, z) => s + z.usedSlots, 0),
    totalSlots: zones.reduce((s, z) => s + z.totalSlots, 0),
    unallocated: parts.filter((p) => !p.rackId || !rackIds.has(p.rackId)),
  };
}
