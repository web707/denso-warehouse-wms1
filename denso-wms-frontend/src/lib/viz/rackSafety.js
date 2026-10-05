export const RACK_SAFETY = {
  slotMaxKg: 500,
  levelMaxKg: 2000,
  rackMaxKg: 10000,
  nearRatio: 0.8,
};

export function loadStatus(weightKg, maxKg) {
  if (weightKg <= 0) return 'empty';
  if (weightKg > maxKg) return 'overload';
  if (weightKg >= maxKg) return 'full';
  if (weightKg >= maxKg * RACK_SAFETY.nearRatio) return 'near';
  return 'active';
}

export function loadPercent(weightKg, maxKg) {
  return maxKg > 0 ? (weightKg / maxKg) * 100 : 0;
}

export const LOAD_STATUS_META = {
  empty: { label: 'Trống', color: '#94a3b8', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  active: { label: 'Đang sử dụng', color: '#22c55e', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  near: { label: 'Gần đầy', color: '#f59e0b', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  full: { label: 'Đầy tải', color: '#6366f1', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  overload: { label: 'Quá tải', color: '#ef4444', badge: 'bg-red-100 text-red-700 border-red-200' },
};
