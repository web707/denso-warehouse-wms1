import { BadRequestException } from '@nestjs/common';
import { WAREHOUSE_RACK } from '../packing/solver/rack-packer';

/**
 * Quy tắc nghiệp vụ thuần (không chạm database) cho giao dịch nhập/xuất/điều chuyển.
 * Tách riêng để kiểm thử được và để service chỉ lo việc đọc/ghi/khóa.
 */

const EPS = 0.001;

export interface Stock {
  quantityPcs: number;
  cartonCount: number;
  weightKg: number;
}

export interface Amounts {
  qty: number;
  cartons: number;
  weight: number;
}

const slotName = (slot: number) => `S${String(slot + 1).padStart(2, '0')}`;
const fmtKg = (n: number) => `${Number(n.toFixed(2))} kg`;

/* ---------- Xuất kho ---------- */

export interface OutboundPlan {
  after: Stock;
  /** Khối lượng thực sự rời kho, ghi vào sổ. Xuất hết thì bằng toàn bộ khối lượng còn lại. */
  loggedWeight: number;
  depleted: boolean;
}

/**
 * Số thùng, số lượng và khối lượng của một PART phải giảm nhất quán:
 *  - không được xuất vượt tồn ở bất kỳ chiều nào;
 *  - hết số lượng thì phải hết thùng (và ngược lại), nếu không còn "tồn ma" không có vị trí;
 *  - còn hàng thì khối lượng còn lại phải lớn hơn 0.
 * Khi xuất hết cả thùng lẫn số lượng, khối lượng còn lại được tính là đã xuất hết.
 */
export function planOutbound(stock: Stock, req: Amounts): OutboundPlan {
  if (req.qty > stock.quantityPcs || req.cartons > stock.cartonCount || req.weight > stock.weightKg + EPS) {
    throw new BadRequestException({ code: 'OUTBOUND_EXCEEDS_STOCK', message: 'Số lượng xuất vượt tồn kho hiện tại' });
  }

  const afterQty = stock.quantityPcs - req.qty;
  const afterCartons = stock.cartonCount - req.cartons;

  if (stock.cartonCount > 0 && stock.quantityPcs > 0 && (afterQty === 0) !== (afterCartons === 0)) {
    throw new BadRequestException({
      code: 'OUTBOUND_INCONSISTENT',
      message:
        afterQty === 0
          ? `Xuất hết ${stock.quantityPcs} cái thì phải xuất hết ${stock.cartonCount} thùng, hiện còn ${afterCartons} thùng`
          : `Xuất hết ${stock.cartonCount} thùng thì phải xuất hết ${stock.quantityPcs} cái, hiện còn ${afterQty} cái`,
    });
  }

  const depleted = afterQty === 0 && afterCartons === 0;
  const rawWeightAfter = Math.max(0, stock.weightKg - req.weight);

  if (!depleted && stock.weightKg > EPS && rawWeightAfter < 0.005) {
    throw new BadRequestException({
      code: 'OUTBOUND_INCONSISTENT',
      message: 'Khối lượng xuất bằng toàn bộ khối lượng PART nhưng vẫn còn hàng trong kho. Hãy nhập khối lượng nhỏ hơn hoặc xuất hết hàng',
    });
  }

  return {
    after: { quantityPcs: afterQty, cartonCount: afterCartons, weightKg: depleted ? 0 : rawWeightAfter },
    loggedWeight: depleted ? stock.weightKg : req.weight,
    depleted,
  };
}

/* ---------- Vị trí khi nhập kho ---------- */

/**
 * Mỗi PART chỉ có một vị trí, nên nhập thêm hàng vào kệ/ô khác sẽ làm dời cả tồn kho cũ.
 * Thay vì dời ngầm, chỉ cho nhập vào đúng vị trí hiện tại (hoặc khi PART chưa có vị trí).
 */
export function assertInboundLocation(
  current: { rackId: string | null; slot: number | null },
  target: { toRackId?: string | null; toSlot?: number | null },
  partName: string,
): void {
  if (!current.rackId) return;
  const sameRack = !target.toRackId || target.toRackId === current.rackId;
  const sameSlot = target.toSlot === undefined || target.toSlot === null || current.slot === null || target.toSlot === current.slot;
  if (!sameRack || !sameSlot) {
    throw new BadRequestException({
      code: 'INBOUND_LOCATION_MISMATCH',
      message: `${partName} đang nằm ở một vị trí khác. Nhập thêm sẽ cộng vào vị trí hiện tại. Muốn đổi chỗ hãy dùng Điều chuyển`,
    });
  }
}

/* ---------- Điều chuyển ---------- */

/**
 * Điều chuyển chuyển TOÀN BỘ PART sang vị trí mới (hệ thống chưa tách PART theo từng vị trí).
 * Số lượng/thùng/kg nếu có nhập phải bằng toàn bộ tồn; bỏ trống thì mặc định là toàn bộ.
 */
export function planTransfer(stock: Stock, req: Amounts): Amounts {
  const mismatch =
    (req.qty > 0 && req.qty !== stock.quantityPcs) ||
    (req.cartons > 0 && req.cartons !== stock.cartonCount) ||
    (req.weight > 0 && Math.abs(req.weight - stock.weightKg) > 0.01);
  if (mismatch) {
    throw new BadRequestException({
      code: 'TRANSFER_PARTIAL_UNSUPPORTED',
      message: `Điều chuyển chuyển toàn bộ PART (${stock.quantityPcs} cái, ${stock.cartonCount} thùng, ${fmtKg(stock.weightKg)}). Chuyển một phần chưa được hỗ trợ, hãy để trống số lượng hoặc nhập đúng toàn bộ`,
    });
  }
  return { qty: stock.quantityPcs, cartons: stock.cartonCount, weight: stock.weightKg };
}

/* ---------- Sức chứa ---------- */

export interface LoadItem {
  weightKg: number;
  cbm: number;
  slot: number | null;
}

export interface RackLimits {
  rackKg: number;
  rackCbm: number;
}

/** Giới hạn của một kệ: tải trọng không vượt mức chung của kho, thể tích theo loại kệ. */
export function rackLimits(rack: {
  maxPayloadKgOverride: string | null;
  maxCbmOverride: string | null;
  containerType: { maxPayloadKg: string; maxCbm: string };
}): RackLimits {
  const payload = Number(rack.maxPayloadKgOverride ?? rack.containerType.maxPayloadKg);
  return {
    rackKg: Math.min(payload, WAREHOUSE_RACK.maxWeightRackKg),
    rackCbm: Number(rack.maxCbmOverride ?? rack.containerType.maxCbm),
  };
}

/**
 * Kiểm tra giới hạn ô (500 kg), tầng (2.000 kg), kệ (tải trọng và thể tích) sau khi thêm/đổi PART.
 * Chỉ chặn khi thao tác này LÀM TĂNG tải vượt giới hạn; kệ đã quá tải từ trước vẫn được xuất bớt
 * hay nhập số lượng không đổi khối lượng.
 *  others: các PART khác trong kệ. before: phần của PART này đang ở kệ (null nếu chưa ở kệ này).
 */
export function assertCapacity(args: {
  rackName: string;
  partName: string;
  limits: RackLimits;
  others: LoadItem[];
  before: LoadItem | null;
  after: LoadItem;
}): void {
  const { rackName, partName, limits, others, before, after } = args;
  const sum = (items: LoadItem[], f: (i: LoadItem) => number) => items.reduce((s, i) => s + f(i), 0);
  const fail = (message: string) => {
    throw new BadRequestException({ code: 'RACK_CAPACITY_EXCEEDED', message });
  };

  // Ô: mỗi ô chỉ chứa một PART
  if (after.slot !== null) {
    const slotBefore = before && before.slot === after.slot ? before.weightKg : 0;
    if (after.weightKg > WAREHOUSE_RACK.maxWeightPerSlotKg + EPS && after.weightKg > slotBefore + EPS) {
      fail(`Ô ${slotName(after.slot)} của ${rackName} chỉ chịu tối đa ${WAREHOUSE_RACK.maxWeightPerSlotKg} kg, ${partName} nặng ${fmtKg(after.weightKg)}`);
    }

    // Tầng: 5 ô cùng tầng
    const level = Math.floor(after.slot / WAREHOUSE_RACK.bays);
    const sameLevel = (i: LoadItem) => i.slot !== null && Math.floor(i.slot / WAREHOUSE_RACK.bays) === level;
    const levelOthers = sum(others.filter(sameLevel), (i) => i.weightKg);
    const levelBefore = levelOthers + (before && sameLevel(before) ? before.weightKg : 0);
    const levelAfter = levelOthers + after.weightKg;
    if (levelAfter > WAREHOUSE_RACK.maxWeightPerLevelKg + EPS && levelAfter > levelBefore + EPS) {
      fail(`Tầng ${level + 1} của ${rackName} chỉ chịu tối đa ${WAREHOUSE_RACK.maxWeightPerLevelKg} kg, sau thao tác sẽ là ${fmtKg(levelAfter)}`);
    }
  }

  // Kệ: tải trọng
  const othersKg = sum(others, (i) => i.weightKg);
  const kgBefore = othersKg + (before?.weightKg ?? 0);
  const kgAfter = othersKg + after.weightKg;
  if (kgAfter > limits.rackKg + EPS && kgAfter > kgBefore + EPS) {
    fail(`${rackName} chỉ chịu tối đa ${fmtKg(limits.rackKg)}, sau thao tác sẽ là ${fmtKg(kgAfter)}`);
  }

  // Kệ: thể tích
  const othersCbm = sum(others, (i) => i.cbm);
  const cbmBefore = othersCbm + (before?.cbm ?? 0);
  const cbmAfter = othersCbm + after.cbm;
  if (cbmAfter > limits.rackCbm + 1e-6 && cbmAfter > cbmBefore + 1e-6) {
    fail(`${rackName} chỉ chứa tối đa ${Number(limits.rackCbm.toFixed(2))} m³, sau thao tác sẽ là ${Number(cbmAfter.toFixed(2))} m³`);
  }
}
