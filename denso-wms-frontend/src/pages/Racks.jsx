import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { fmtDec, fmtNum } from '@/lib/calculations';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Warehouse,
  Search,
  MapPin,
  Boxes,
  Weight,
  Layers3,
  Loader2,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  MapPinned,
} from 'lucide-react';
import WarehouseScene3D from '@/components/viz/WarehouseScene3D';
import { RACKS_PER_ZONE, RACK_STATUS_META, SLOTS_PER_RACK, WAREHOUSE_CODE, compareRacks, slotCode, summarizeRack, zoneOf } from '@/lib/warehouse';

const TARGET_RACKS = RACKS_PER_ZONE;
const STATUS_META = RACK_STATUS_META;

export default function Racks() {
  const { orders, parts, racks, rackTypes, currentOrderId, initializeWarehouse } = useStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedRackId, setSelectedRackId] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [zones, setZones] = useState([]);

  const selectedZone = (searchParams.get('zone') || 'ZONE-A').toUpperCase();

  useEffect(() => {
    api.zones.list({ warehouseCode: WAREHOUSE_CODE }).then(setZones).catch(() => setZones([]));
  }, []);

  const anchorOrderId = useMemo(
    () => racks.find((r) => r.orderId)?.orderId || currentOrderId || orders[0]?.id || null,
    [racks, currentOrderId, orders],
  );

  const zoneMeta = useMemo(() => zones.find((z) => z.code === selectedZone), [zones, selectedZone]);

  const warehouseRacks = useMemo(() => [...racks]
    .filter((r) => (r.warehouseCode || WAREHOUSE_CODE) === WAREHOUSE_CODE && zoneOf(r) === selectedZone)
    .sort(compareRacks)
    .slice(0, TARGET_RACKS), [racks, selectedZone]);

  const rackSummaries = useMemo(() => warehouseRacks.map((rack) => {
    const sum = summarizeRack(rack, parts);
    return { ...rack, rackParts: sum.parts, partCount: sum.partCount, usedSlots: sum.usedSlots, totalWeight: sum.totalWeight, totalCbm: sum.totalCbm, status: sum.status };
  }), [warehouseRacks, parts]);

  const zoneRackIds = useMemo(() => new Set(warehouseRacks.map((r) => r.id)), [warehouseRacks]);
  const query = search.trim().toLowerCase();
  const matchedParts = useMemo(() => {
    if (!query) return [];
    return parts.filter((p) => zoneRackIds.has(p.rackId) && (
      p.partName?.toLowerCase().includes(query)
      || p.productCode?.toLowerCase().includes(query)
      || p.masterPo?.toLowerCase().includes(query)
    ));
  }, [parts, query, zoneRackIds]);

  const highlightedRackIds = useMemo(() => new Set(matchedParts.map((p) => p.rackId).filter(Boolean)), [matchedParts]);

  const totals = useMemo(() => {
    const usedSlots = rackSummaries.reduce((s, r) => s + r.usedSlots, 0);
    const usedRacks = rackSummaries.filter((r) => r.usedSlots > 0).length;
    const overloaded = rackSummaries.filter((r) => r.status === 'overload').length;
    const near = rackSummaries.filter((r) => r.status === 'near').length;
    const totalWeight = rackSummaries.reduce((s, r) => s + r.totalWeight, 0);
    const zoneParts = rackSummaries.reduce((s, r) => s + r.partCount, 0);
    return { usedSlots, usedRacks, overloaded, near, totalWeight, zoneParts };
  }, [rackSummaries]);

  const handleInitialize = async () => {
    if (!anchorOrderId) {
      toast({ variant: 'destructive', title: 'Chưa có lô linh kiện', description: 'Hãy tạo hoặc nhập một lô linh kiện trước khi khởi tạo 20 kệ.' });
      return;
    }
    setInitializing(true);
    try {
      const rackTypeId = warehouseRacks[0]?.rackTypeId || racks[0]?.rackTypeId || rackTypes[0]?.id;
      const result = await initializeWarehouse({
        orderId: anchorOrderId,
        warehouseCode: WAREHOUSE_CODE,
        zoneCode: selectedZone,
        rackCount: TARGET_RACKS,
        rackTypeId,
      });
      toast({
        title: `Đã khởi tạo ${selectedZone}`,
        description: result.createdCount > 0
          ? `Đã tạo thêm ${result.createdCount} kệ. ${selectedZone} hiện có R01–R20 riêng.`
          : `${selectedZone} đã đủ R01–R20.`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: `Không thể khởi tạo ${selectedZone}`, description: err.message });
    } finally {
      setInitializing(false);
    }
  };

  const openRack = (rackId, part) => {
    const suffix = part ? `?q=${encodeURIComponent(part.partName || part.productCode || part.masterPo || '')}` : '';
    navigate(`/racks/${rackId}/plan${suffix}`);
  };

  const switchZone = (zoneCode) => {
    setSelectedRackId(null);
    setSearch('');
    setSearchParams({ zone: zoneCode });
  };

  return <div className="p-4 sm:p-6 md:p-8 max-w-[1550px] mx-auto space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-semibold text-slate-900">Sơ đồ kho 3D · {selectedZone}</h1>
          <Badge variant="outline" className="bg-white">{WAREHOUSE_CODE} / {selectedZone}</Badge>
          {zoneMeta && <Badge variant="secondary">{zoneMeta.name}</Badge>}
        </div>
        <p className="text-sm text-slate-500 mt-1">Mỗi Zone có 20 kệ riêng · 4 dãy × 5 kệ · mỗi kệ 20 ô · tổng 400 vị trí/Zone</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">Đang xem Zone
          <select className="block mt-1 h-10 rounded-md border bg-white px-3 min-w-44" value={selectedZone} onChange={(e) => switchZone(e.target.value)}>
            {(zones.length ? zones : [{ code: selectedZone, name: selectedZone }]).map((z) => <option key={z.code} value={z.code}>{z.code} · {z.name}</option>)}
          </select>
        </label>
        <Button variant="outline" onClick={() => navigate('/zones')}><MapPinned className="w-4 h-4 mr-1.5" />Quản lý Zone</Button>
        {warehouseRacks.length < TARGET_RACKS && <Button onClick={handleInitialize} disabled={initializing || !anchorOrderId}>
          {initializing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}Khởi tạo đủ 20 kệ
        </Button>}
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <MiniStat icon={Warehouse} label="Kệ vật lý trong Zone" value={`${warehouseRacks.length}/${TARGET_RACKS}`} sub={`${selectedZone} · R01–R20`} />
      <MiniStat icon={Layers3} label="Kệ đang dùng" value={totals.usedRacks} sub={`${Math.max(0, warehouseRacks.length - totals.usedRacks)} kệ trống`} />
      <MiniStat icon={Boxes} label="Ô đang dùng" value={`${totals.usedSlots}/${TARGET_RACKS * SLOTS_PER_RACK}`} sub={`${TARGET_RACKS * SLOTS_PER_RACK - totals.usedSlots} ô trống`} />
      <MiniStat icon={Weight} label="Khối lượng trong Zone" value={`${fmtNum(totals.totalWeight)} kg`} sub={`${totals.zoneParts} PART đã xếp`} />
      <MiniStat icon={AlertTriangle} label="Cảnh báo kệ" value={totals.overloaded + totals.near} sub={totals.overloaded ? `${totals.overloaded} kệ quá tải` : totals.near ? `${totals.near} kệ gần đầy` : 'Không có cảnh báo'} danger={totals.overloaded > 0} />
    </div>

    <Card>
      <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3">
        <div><CardTitle className="text-base">Mô hình bên trong {selectedZone}</CardTitle><p className="text-xs text-slate-400 mt-1">Kéo để xoay · cuộn để zoom · hover xem nhanh · click kệ để mở chi tiết S01–S20</p></div>
        <div className="relative w-full sm:w-[360px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Tìm PART trong ${selectedZone}...`} className="pl-9" /></div>
      </div></CardHeader>
      <CardContent className="space-y-3">
        {warehouseRacks.length === 0 ? <div className="h-[520px] rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-8">
          <Warehouse className="w-12 h-12 text-slate-300 mb-3" /><p className="font-semibold text-slate-700">{selectedZone} chưa có kệ</p><p className="text-sm text-slate-400 mt-1 max-w-md">Đây là Zone độc lập. Bấm “Khởi tạo đủ 20 kệ” để tạo R01–R20 mới cho riêng {selectedZone}.</p><Button className="mt-4" onClick={handleInitialize} disabled={initializing || !anchorOrderId}>{initializing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}Khởi tạo {selectedZone}</Button>
        </div> : <WarehouseScene3D racks={rackSummaries} selectedRackId={selectedRackId} highlightedRackIds={highlightedRackIds} onSelectRack={(id) => { setSelectedRackId(id); openRack(id); }} warehouseCode={WAREHOUSE_CODE} zoneCode={selectedZone} className="rounded-xl overflow-hidden border" />}
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500"><Legend swatch="bg-slate-400" label="Trống" /><Legend swatch="bg-emerald-500" label="Đang sử dụng" /><Legend swatch="bg-amber-500" label="Gần đầy (≥80%)" /><Legend swatch="bg-indigo-500" label="Đầy 20/20 ô" /><Legend swatch="bg-red-500" label="Quá tải" /></div>
      </CardContent>
    </Card>

    {query && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Kết quả tìm trong {selectedZone}</CardTitle></CardHeader><CardContent>
      {matchedParts.length === 0 ? <p className="text-sm text-slate-400 py-3">Không tìm thấy linh kiện phù hợp trong Zone này.</p> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">{matchedParts.slice(0, 30).map((part) => {
        const rack = rackSummaries.find((r) => r.id === part.rackId);
        const slot = Number.isInteger(part.preferredRackSlot) ? slotCode(part.preferredRackSlot) : 'Chưa cố định ô';
        return <button key={part.id} type="button" disabled={!rack} onClick={() => rack && openRack(rack.id, part)} className="text-left rounded-lg border p-3 hover:border-indigo-300 hover:bg-indigo-50/30 disabled:opacity-50 transition"><p className="font-semibold text-sm text-slate-800 truncate">{part.partName}</p><p className="text-xs text-slate-500 mt-1">{part.productCode || 'Không có mã'} · PO {part.masterPo}</p><p className="text-xs text-indigo-600 mt-1.5">{rack ? `${selectedZone} / ${rack.name} · ${slot}` : 'Chưa phân bổ'}</p></button>;
      })}</div>}
    </CardContent></Card>}

    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between"><div><CardTitle className="text-base">Danh sách {selectedZone} / R01–R20</CardTitle><p className="text-xs text-slate-400 mt-1">Mỗi Zone sở hữu bộ R01–R20 riêng, không lấy kệ từ Zone khác.</p></div><div className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {selectedZone}</div></CardHeader>
      <CardContent><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{rackSummaries.map((rack) => {
        const meta = STATUS_META[rack.status]; const pct = (rack.usedSlots / SLOTS_PER_RACK) * 100;
        return <button type="button" key={rack.id} onClick={() => openRack(rack.id)} className="text-left rounded-xl border bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900">{rack.name}</p><p className="text-[11px] text-slate-400 mt-0.5">{rack.warehouseCode} / {rack.zoneCode}</p></div><Badge className={meta.badge}>{meta.label}</Badge></div><div className="mt-4 space-y-2"><div className="flex justify-between text-xs"><span className="text-slate-500">Ô sử dụng</span><strong>{rack.usedSlots}/20</strong></div><Progress value={pct} className="h-1.5" /><div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1"><span>{rack.partCount} PART</span><span className="text-right">{fmtNum(rack.totalWeight)} kg</span><span>{fmtDec(rack.totalCbm, 2)} m³</span><span className="text-right text-indigo-600 flex items-center justify-end gap-1">Chi tiết <ArrowRight className="w-3 h-3" /></span></div></div></button>;
      })}</div>
      {rackSummaries.length < TARGET_RACKS && <div className="mt-4 rounded-lg border border-dashed bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-700">{selectedZone} còn thiếu {TARGET_RACKS - rackSummaries.length} kệ</p><p className="text-xs text-slate-400 mt-0.5">Chỉ tạo kệ mới trong {selectedZone}; kệ của Zone A/B/C khác không bị di chuyển.</p></div><Button variant="outline" onClick={handleInitialize} disabled={initializing || !anchorOrderId}>{initializing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}Tạo R01–R20 cho {selectedZone}</Button></div>}
      </CardContent>
    </Card>
  </div>;
}

function MiniStat({ icon: Icon, label, value, sub, danger = false }) {
  return <Card><CardContent className="py-4 flex items-center gap-3"><div className={`w-9 h-9 rounded-lg flex items-center justify-center ${danger ? 'bg-red-50' : 'bg-indigo-50'}`}><Icon className={`w-4 h-4 ${danger ? 'text-red-600' : 'text-indigo-600'}`} /></div><div className="min-w-0"><p className="text-[11px] text-slate-400 truncate">{label}</p><p className="font-bold text-slate-800">{value}</p><p className="text-[10px] text-slate-400 truncate">{sub}</p></div></CardContent></Card>;
}
function Legend({ swatch, label }) { return <span className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${swatch}`} />{label}</span>; }
