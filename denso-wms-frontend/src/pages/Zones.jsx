import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Eye, Layers3, Loader2, MapPinned, Plus, Sparkles, Warehouse } from 'lucide-react';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { RACKS_PER_ZONE, WAREHOUSE_CODE, summarizeZone } from '@/lib/warehouse';

const TARGET_RACKS = RACKS_PER_ZONE;

export default function Zones() {
  const { orders, parts, racks, rackTypes, currentOrderId, initializeWarehouse } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [code, setCode] = useState('ZONE-D');
  const [name, setName] = useState('Khu D');
  const [creating, setCreating] = useState(false);
  const [initializingCode, setInitializingCode] = useState(null);

  const load = async () => setZones(await api.zones.list({ warehouseCode: 'DENSO-WH' }));
  useEffect(() => { load().catch(() => {}); }, []);

  const anchorOrderId = useMemo(
    () => racks.find((r) => r.orderId)?.orderId || currentOrderId || orders[0]?.id || null,
    [racks, currentOrderId, orders],
  );

  const summaries = useMemo(() => zones.map((zone) => {
    const sum = summarizeZone(zone.code, racks.filter((r) => (r.warehouseCode || WAREHOUSE_CODE) === zone.warehouseCode), parts);
    const zoneRacks = sum.racks.map((r) => r.rack);
    const zoneParts = sum.racks.flatMap((r) => r.parts);
    return { zone, zoneRacks, zoneParts, usedRacks: sum.usedRacks, usedSlots: sum.usedSlots, weight: sum.totalWeight };
  }), [zones, racks, parts]);

  const createZone = async () => {
    if (!code.trim() || !name.trim()) return;
    setCreating(true);
    try {
      const created = await api.zones.create({ warehouseCode: 'DENSO-WH', code: code.trim().toUpperCase(), name: name.trim() });
      await load();
      toast({ title: 'Đã tạo Zone mới', description: `${created.code} được tạo độc lập và hiện chưa có kệ.` });
      setCode('ZONE-D');
      setName('Khu D');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không tạo được Zone', description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const initializeZone = async (zoneCode) => {
    if (!anchorOrderId) {
      toast({ variant: 'destructive', title: 'Chưa có lô linh kiện', description: 'Cần có ít nhất một lô linh kiện để khởi tạo kệ cho Zone mới.' });
      return;
    }
    setInitializingCode(zoneCode);
    try {
      const currentZoneRack = racks.find((r) => r.zoneCode === zoneCode);
      const rackTypeId = currentZoneRack?.rackTypeId || racks[0]?.rackTypeId || rackTypes[0]?.id;
      const result = await initializeWarehouse({
        orderId: anchorOrderId,
        warehouseCode: 'DENSO-WH',
        zoneCode,
        rackCount: TARGET_RACKS,
        rackTypeId,
      });
      toast({
        title: `Đã khởi tạo ${zoneCode}`,
        description: result.createdCount > 0
          ? `Đã tạo ${result.createdCount} kệ mới. ${zoneCode} hiện có đủ R01–R20 độc lập.`
          : `${zoneCode} đã đủ 20 kệ, không tạo thêm.`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: `Không khởi tạo được ${zoneCode}`, description: e.message });
    } finally {
      setInitializingCode(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quản lý Zone</h1>
          <p className="text-sm text-slate-500 mt-1">Mỗi Zone là một khu kho độc lập, có mô hình 3D và tối đa 20 kệ riêng (400 ô/Zone).</p>
        </div>
        <Badge variant="outline" className="bg-white gap-1.5"><Warehouse className="w-3.5 h-3.5" /> DENSO-WH</Badge>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {summaries.map(({ zone, zoneRacks, zoneParts, usedRacks, usedSlots, weight }) => {
          const rackPct = Math.min(100, (zoneRacks.length / TARGET_RACKS) * 100);
          const isInitializing = initializingCode === zone.code;
          return (
            <div key={zone.id} className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">{zone.warehouseCode}</div>
                  <div className="font-bold text-xl">{zone.code}</div>
                  <div className="text-sm text-slate-600">{zone.name}</div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center"><MapPinned className="w-6 h-6 text-indigo-500" /></div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5 text-center">
                <div className="rounded-xl bg-slate-50 border p-2"><div className="font-bold text-lg">{zoneRacks.length}/20</div><div className="text-[10px] text-slate-500">Kệ vật lý</div></div>
                <div className="rounded-xl bg-slate-50 border p-2"><div className="font-bold text-lg">{usedRacks}</div><div className="text-[10px] text-slate-500">Kệ có hàng</div></div>
                <div className="rounded-xl bg-slate-50 border p-2"><div className="font-bold text-lg">{usedSlots}</div><div className="text-[10px] text-slate-500">Ô đang dùng</div></div>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-slate-500">Mức khởi tạo kệ</span><strong>{zoneRacks.length}/{TARGET_RACKS}</strong></div>
                <Progress value={rackPct} className="h-1.5" />
                <div className="flex justify-between text-[11px] text-slate-400"><span>{zoneParts.length} PART</span><span>{weight.toLocaleString('vi-VN')} kg</span></div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5">
                <Button variant="outline" onClick={() => navigate(`/racks?zone=${encodeURIComponent(zone.code)}`)}>
                  <Eye className="w-4 h-4 mr-1.5" /> Mở mô hình
                </Button>
                <Button onClick={() => initializeZone(zone.code)} disabled={isInitializing || zoneRacks.length >= TARGET_RACKS || !anchorOrderId}>
                  {isInitializing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                  {zoneRacks.length >= TARGET_RACKS ? 'Đã đủ 20 kệ' : 'Khởi tạo 20 kệ'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <div className="flex items-center gap-2 font-bold mb-1"><Plus className="w-4 h-4" /> Tạo Zone hoàn toàn mới</div>
        <p className="text-xs text-slate-400 mb-4">Tạo Zone chỉ tạo khu vực. Sau đó bấm “Khởi tạo 20 kệ” trên thẻ Zone để tạo R01–R20 riêng cho khu đó.</p>
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-40" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ZONE-D" />
          <Input className="max-w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="Khu D" />
          <Button onClick={createZone} disabled={creating}>{creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}Tạo Zone</Button>
        </div>
      </div>

      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5">
        <div className="font-bold text-indigo-900 flex items-center gap-2"><Layers3 className="w-4 h-4" /> Logic Multi-Zone mới</div>
        <div className="grid md:grid-cols-3 gap-3 mt-3 text-sm text-slate-600">
          <div className="bg-white/80 rounded-xl p-3 border"><b>ZONE-A</b><div className="text-xs mt-1">R01–R20 riêng · 400 ô riêng</div></div>
          <div className="bg-white/80 rounded-xl p-3 border"><b>ZONE-B</b><div className="text-xs mt-1">R01–R20 riêng · không lấy kệ từ A</div></div>
          <div className="bg-white/80 rounded-xl p-3 border"><b>ZONE-C</b><div className="text-xs mt-1">R01–R20 riêng · có mô hình 3D riêng</div></div>
        </div>
        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5"><Boxes className="w-3.5 h-3.5" /> Khi khởi tạo cả A, B, C: tổng cộng 60 kệ và 1.200 ô lưu trữ. Tên R01 có thể lặp giữa các Zone vì vị trí đầy đủ luôn là ZONE-A/R01, ZONE-B/R01...</p>
      </div>
    </div>
  );
}
