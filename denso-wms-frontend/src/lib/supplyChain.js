import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';

/* ---------- Truy vấn dữ liệu (react-query) ---------- */

export const KEYS = {
  workOrders: ['work-orders'],
  inspections: ['inspections'],
  shipments: ['shipments'],
  lotStatus: ['inspections', 'lot-status'],
};

export const useWorkOrders = () => useQuery({ queryKey: KEYS.workOrders, queryFn: () => api.workOrders.list() });
export const useInspections = () => useQuery({ queryKey: KEYS.inspections, queryFn: () => api.inspections.list() });
export const useShipments = () => useQuery({ queryKey: KEYS.shipments, queryFn: () => api.shipments.list() });
export const useLotStatus = () => useQuery({ queryKey: KEYS.lotStatus, queryFn: () => api.inspections.lotStatus() });

/* ---------- Nhãn tiếng Việt ---------- */

export const WO_TYPES = [
  { value: 'STANDARD', label: 'Standard — sản xuất thường' },
  { value: 'REWORK', label: 'Rework — làm lại' },
  { value: 'TRANSFORM', label: 'Transform — chuyển đổi' },
];

export const WO_STATUS = {
  UNRELEASED: { label: 'Chưa phát hành', tone: 'slate' },
  RELEASED: { label: 'Đang sản xuất', tone: 'indigo' },
  COMPLETED: { label: 'Hoàn thành', tone: 'green' },
  ON_HOLD: { label: 'Tạm dừng', tone: 'amber' },
  CANCELLED: { label: 'Đã hủy', tone: 'slate' },
};

export const INSPECTION_TYPES = [
  { value: 'INCOMING', label: 'INCOMING — nhập hàng' },
  { value: 'IN-PROCESS', label: 'IN-PROCESS — trong sản xuất' },
  { value: 'FINAL', label: 'FINAL — thành phẩm' },
];

export const JUDGMENT = {
  OK: { label: 'OK', tone: 'green' },
  NG: { label: 'NG', tone: 'red' },
  HOLD: { label: 'HOLD', tone: 'amber' },
};

export const SHIPMENT_STATUS = {
  RELEASED: { label: 'Chờ giao', tone: 'amber' },
  SHIPPED: { label: 'Đang vận chuyển', tone: 'indigo' },
  DELIVERED: { label: 'Đã giao', tone: 'green' },
};

/* ---------- Quy tắc nghiệp vụ ---------- */

const DAY_MS = 86_400_000;
const startOfToday = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

/** Lệnh sản xuất trễ hạn: quá hạn giao mà chưa hoàn thành/hủy. */
export function isWorkOrderOverdue(wo, now = new Date()) {
  if (!wo.dueDate || wo.workOrderStatus === 'COMPLETED' || wo.workOrderStatus === 'CANCELLED') return false;
  return new Date(wo.dueDate) < startOfToday(now);
}

export function workOrderProgress(wo) {
  const planned = Number(wo.plannedStartQuantity) || 0;
  if (planned <= 0) return { donePct: 0, scrapPct: 0, remaining: 0 };
  const done = Number(wo.completedQuantity) || 0;
  const scrap = Number(wo.scrappedQuantity) || 0;
  return {
    donePct: Math.min(100, (done / planned) * 100),
    scrapPct: Math.min(100 - Math.min(100, (done / planned) * 100), (scrap / planned) * 100),
    remaining: Math.max(0, planned - done - scrap),
  };
}

/** Map lotNumber -> kết luận kiểm tra mới nhất ({ judgment, inspectionId, ... }). */
export function lotStatusMap(list = []) {
  return new Map(list.map((l) => [l.lotNumber, l]));
}

/** Kiểm tra giá trị đo có nằm ngoài dung sai không (khớp quy tắc ở backend). */
export function outOfTolerance({ measuredValue1, upperTolerance, lowerTolerance }) {
  const has = (v) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));
  if (!has(measuredValue1)) return false;
  const m = Number(measuredValue1);
  if (has(upperTolerance) && m > Number(upperTolerance)) return true;
  if (has(lowerTolerance) && m < Number(lowerTolerance)) return true;
  return false;
}

export function shipmentDelayTone(days) {
  if (days === null || days === undefined) return null;
  return days > 0 ? 'red' : 'green';
}

export const isShipmentLate = (s) => (s.delayDays ?? 0) > 0 && s.shipmentStatus === 'RELEASED';

/* ---------- Chuyển đổi ngày giờ cho ô nhập ---------- */

const pad = (n) => String(n).padStart(2, '0');

export function isoToDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoToDateTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${isoToDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 'YYYY-MM-DD' hoặc 'YYYY-MM-DDTHH:mm' (giờ địa phương) -> ISO; rỗng -> null. */
export function inputToIso(value) {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
export const strOrNull = (v) => (v && String(v).trim() ? String(v).trim() : null);

export function fmtDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

export { DAY_MS };
