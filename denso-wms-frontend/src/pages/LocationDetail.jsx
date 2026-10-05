import { useEffect, useMemo, useState } from 'react';
import { parseSlotCode, slotPosition } from '@/lib/warehouse';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, Boxes, History, MapPin, PackagePlus, PackageMinus, Warehouse, Weight } from 'lucide-react';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { buildRackLayout } from '@/lib/viz/rackLayout';
import { LOAD_STATUS_META, RACK_SAFETY, loadStatus, loadPercent } from '@/lib/viz/rackSafety';

function placementWeight(p, partsById) {
  const part = partsById[p.partId];
  if (!part?.cartons) return 0;
  return Number(part.weight || 0) / Math.max(1, Number(part.cartons || 1));
}

export default function LocationDetail() {
  const { rackId, slotCode } = useParams();
  const navigate = useNavigate();
  const { racks, parts } = useStore();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const rack = racks.find((r) => r.id === rackId);
  const slotIndex = parseSlotCode(slotCode);
  const partsById = useMemo(() => Object.fromEntries(parts.map((p) => [p.id, p])), [parts]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.storage.plan(rackId).then((d) => { if (!cancelled) setPlan(d); }).catch(() => { if (!cancelled) setPlan(null); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [rackId]);

  const layout = useMemo(() => buildRackLayout(plan?.placements || []), [plan]);
  const slot = layout.slots.find((s) => s.index === slotIndex);
  const placementIds = [...new Set((slot?.placements || []).map((p) => p.partId))];
  const fallbackParts = parts.filter((p) => p.rackId === rackId && p.preferredRackSlot === slotIndex);
  const slotParts = placementIds.length ? placementIds.map((id) => partsById[id]).filter(Boolean) : fallbackParts;
  const cartons = slot?.placements?.length || slotParts.reduce((s, p) => s + Number(p.cartons || 0), 0);
  const weightKg = slot?.placements?.length ? slot.placements.reduce((s, p) => s + placementWeight(p, partsById), 0) : slotParts.reduce((s, p) => s + Number(p.weight || 0), 0);
  const status = loadStatus(weightKg, RACK_SAFETY.slotMaxKg);
  const meta = LOAD_STATUS_META[status];
  const firstPart = slotParts[0];
  const opUrl = (mode) => `/inventory?mode=${mode}${firstPart ? `&partId=${encodeURIComponent(firstPart.id)}` : ''}&rackId=${encodeURIComponent(rackId)}&slot=${slotIndex}`;

  if (loading) return <div className="p-10 text-slate-500">Đang tải vị trí...</div>;
  return <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-5">
    <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button><div><h1 className="text-2xl font-semibold">{rack?.zoneCode} / {rack?.name} / {String(slotCode).toUpperCase()}</h1><p className="text-sm text-slate-500">Trang truy cập nhanh từ QR vị trí kho.</p></div></div>
    <div className="grid md:grid-cols-4 gap-3">
      <Info icon={MapPin} label="Vị trí" value={`Tầng ${slotPosition(slotIndex).level} · Khoang ${slotPosition(slotIndex).bay}`} />
      <Info icon={Boxes} label="Số thùng" value={cartons} />
      <Info icon={Weight} label="Tải trọng" value={`${weightKg.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} / ${RACK_SAFETY.slotMaxKg} kg`} />
      <Info icon={Warehouse} label="Trạng thái" value={meta.label} color={meta.color} sub={`${loadPercent(weightKg, RACK_SAFETY.slotMaxKg).toFixed(1)}% tải ô`} />
    </div>
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-4"><div><div className="text-sm font-bold">Linh kiện trong ô</div><div className="text-xs text-slate-400">{rack?.warehouseCode} / {rack?.zoneCode} / {rack?.name} / {String(slotCode).toUpperCase()}</div></div><span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: meta.color, background: `${meta.color}18` }}>{meta.label}</span></div>
      {slotParts.length === 0 ? <div className="py-12 text-center text-slate-400">Ô này đang trống.</div> : <div className="space-y-2">{slotParts.map((p) => <div key={p.id} className="rounded-xl border p-4 flex items-center justify-between gap-4"><div><div className="font-bold">{p.partName}</div><div className="text-xs text-slate-500">{p.productCode || p.masterPo} · {p.cartons} thùng · {Number(p.weight || 0).toLocaleString('vi-VN')} kg</div></div><Button variant="outline" onClick={() => navigate(`/racks/${rackId}/plan?q=${encodeURIComponent(p.productCode || p.partName)}`)}>Xem trên 3D</Button></div>)}</div>}
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Button className="h-12" onClick={() => navigate(opUrl('inbound'))}><PackagePlus className="w-4 h-4 mr-2" />Nhập thêm</Button>
      <Button className="h-12" variant="outline" disabled={!firstPart} onClick={() => navigate(opUrl('outbound'))}><PackageMinus className="w-4 h-4 mr-2" />Xuất hàng</Button>
      <Button className="h-12" variant="outline" disabled={!firstPart} onClick={() => navigate(opUrl('transfer'))}><ArrowRightLeft className="w-4 h-4 mr-2" />Điều chuyển</Button>
      <Button className="h-12" variant="outline" onClick={() => navigate('/history')}><History className="w-4 h-4 mr-2" />Lịch sử kho</Button>
    </div>
  </div>;
}

function Info({ icon: Icon, label, value, sub, color }) {
  return <div className="rounded-xl border bg-white p-4"><Icon className="w-4 h-4 mb-3 text-indigo-600" /><div className="text-xs text-slate-400">{label}</div><div className="font-bold mt-1" style={color ? { color } : undefined}>{value}</div>{sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}</div>;
}
