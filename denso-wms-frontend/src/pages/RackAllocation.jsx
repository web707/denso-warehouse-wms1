import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { api } from '@/api';
import { calcRackStats, calcPartCbm, calcMaxCartonsFit, fmtDec, fmtNum, fmtKg, utilColor } from '@/lib/calculations';
import { useToast } from '@/components/ui/use-toast';
import UtilizationBar from '@/components/UtilizationBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, MoreVertical, X, Package, ArrowLeftRight, FileDown, Loader2, Boxes, AlertTriangle, CheckCircle2, Info, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import RackRecommendationBanner, {
  useRackRecommendation,
} from '@/components/RackRecommendation';

// Dedicated page per order (/racks/:orderId) — the rack cards,
// unallocated pool, and "Thêm Kệ kho" action all act on exactly this
// order, matching the same one-page-per-order pattern as OrderDetail.
export default function RackAllocation() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { racks, parts, orders, deleteRack, assignPart } = useStore();
  const { toast } = useToast();
  const [addRackOpen, setAddRackOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const order = orders.find((o) => o.id === orderId);
  const orderRacks = useMemo(() => racks.filter((c) => c.orderId === orderId), [racks, orderId]);
  const orderParts = useMemo(() => parts.filter((p) => p.orderId === orderId), [parts, orderId]);
  const stats = useMemo(
    () => orderRacks.map((c) => ({ rack: c, ...calcRackStats(orderParts, c) })),
    [orderRacks, orderParts],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.storage.exportOrderXlsx(orderId);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bao-cao-${order?.name || 'don-hang'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Đã xuất báo cáo', description: 'File Excel đã được tải xuống' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Xuất báo cáo thất bại', description: err.message });
    } finally {
      setExporting(false);
    }
  };

  if (!order) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/racks')} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Tất cả đơn hàng
        </Button>
        <p className="text-sm text-slate-400">Không tìm thấy đơn hàng này.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/racks')} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Tất cả đơn hàng
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{order.name || order.orderNumber}</h1>
          <p className="text-sm text-slate-500 mt-1">Theo dõi mức độ sử dụng ô kệ, CBM và trọng lượng</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileDown className="w-4 h-4 mr-1.5" />}
            Xuất báo cáo
          </Button>
          <Button variant="outline" onClick={() => setAddRackOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Thêm Kệ kho
          </Button>
        </div>
      </div>

      {/* ── Goods Overview Panel ── */}
      <GoodsOverviewPanel parts={orderParts} racks={orderRacks} />

      <UnallocatedPool parts={orderParts} racks={orderRacks} onAssign={assignPart} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {stats.map(({ rack, ...st }) => (
          <RackCard
            key={rack.id}
            rack={rack}
            stats={st}
            onUnassign={(pid) => assignPart(pid, null)}
            onDelete={() => deleteRack(rack.id)}
          />
        ))}
      </div>

      <AddRackDialog
        open={addRackOpen}
        onOpenChange={setAddRackOpen}
        orderId={orderId}
        existingCount={orderRacks.length}
      />
    </div>
  );
}

// ===== Add another rack to this order =====
function AddRackDialog({ open, onOpenChange, orderId, existingCount }) {
  const { rackTypes, createRackForOrder, autoAssignRack } = useStore();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: `Kệ ${existingCount + 1}`, rackTypeId: '', warehouseCode: 'DENSO-WH', zoneCode: 'ZONE-A' });
  const [busy, setBusy] = useState(false);
  const { recommendation, loading: recLoading } = useRackRecommendation(open ? orderId : null);

  useEffect(() => {
    if (open && recommendation?.recommendedRackTypeId) {
      setForm((f) => ({ ...f, rackTypeId: f.rackTypeId || recommendation.recommendedRackTypeId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recommendation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rackTypeId) return;
    setBusy(true);
    try {
      const rack = await createRackForOrder(orderId, form);
      const result = await autoAssignRack(rack.id);
      toast({
        title: 'Đã thêm kệ kho',
        description:
          result.remainingUnassignedCount > 0
            ? `Đã phân bổ ${result.assignedCount} PART — còn ${result.remainingUnassignedCount} PART chưa xếp`
            : `Đã phân bổ ${result.assignedCount} PART`,
      });
      onOpenChange(false);
      setForm({ name: `Kệ ${existingCount + 2}`, rackTypeId: '', warehouseCode: 'DENSO-WH', zoneCode: 'ZONE-A' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Không thể thêm kệ kho', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm Kệ kho</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <RackRecommendationBanner
            recommendation={recommendation}
            loading={recLoading}
            rackTypes={rackTypes}
          />
          <div className="space-y-1.5">
            <Label>Tên kệ</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kho</Label>
              <Input value={form.warehouseCode} onChange={(e) => setForm((f) => ({ ...f, warehouseCode: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Khu vực</Label>
              <Select value={form.zoneCode} onValueChange={(v) => setForm((f) => ({ ...f, zoneCode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZONE-A">ZONE-A</SelectItem>
                  <SelectItem value="ZONE-B">ZONE-B</SelectItem>
                  <SelectItem value="ZONE-C">ZONE-C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cấu hình sức chứa</Label>
            <Select value={form.rackTypeId} onValueChange={(v) => setForm((f) => ({ ...f, rackTypeId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn cấu hình..." />
              </SelectTrigger>
              <SelectContent>
                {rackTypes.map((t, index) => (
                  <SelectItem key={t.id} value={t.id}>Kệ 20 ô · Cấu hình {index + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Thêm & phân bổ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===== Unallocated Pool =====
function UnallocatedPool({ parts, racks, onAssign }) {
  const unallocated = parts.filter((p) => !p.rackId);
  if (unallocated.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
          <Package className="w-4 h-4" />
          Hàng chờ phân bổ ({unallocated.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {unallocated.map((p) => (
            <div key={p.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 pl-2.5 pr-1 py-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-xs font-medium text-slate-700">{p.partName}</span>
              <span className="text-[11px] text-slate-400">{fmtDec(calcPartCbm(p), 2)} m³</span>
              <RackPicker value="" onValue={(cid) => onAssign(p.id, cid)} racks={racks} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RackPicker({ value, onValue, racks }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <ArrowLeftRight className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {racks.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => onValue(c.id)}>
            → {c.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ===== Rack Card =====
function RackCard({ rack, stats, onUnassign, onDelete }) {
  const assigned = stats.parts;
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{rack.name}</CardTitle>
            <Badge variant="secondary" className="text-xs">Kệ 20 ô</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => navigate(`/racks/${rack.id}/plan`)}
            >
              <Boxes className="w-3.5 h-3.5 mr-1.5" /> Sơ đồ 3D
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-red-600" onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa kệ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <UtilizationBar percent={stats.cbmPct} label="Dung lượng (CBM)" sublabel={`${fmtDec(stats.totalCbm, 2)} / ${rack.maxCbm} m³`} />
          <UtilizationBar percent={stats.weightPct} label="Trọng lượng" sublabel={`${fmtNum(stats.totalWeight)} / ${fmtNum(rack.maxWeight)} kg`} />
        </div>

        <RackVisual stats={stats} maxCbm={rack.maxCbm} />

        <Separator />

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            PART trên kệ ({assigned.length})
          </p>
          {assigned.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Chưa có hàng nào được phân bổ.</p>
          ) : (
            <div className="space-y-1.5">
              {assigned.map((p) => {
                const fit = calcMaxCartonsFit(p.cartonLength, p.cartonWidth, p.cartonHeight);
                return (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 group">
                    <span className="w-3 h-3 rounded shrink-0" style={{ background: p.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{p.partName}</span>
                        <span className="text-[11px] text-slate-400">{p.productCode}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {fmtNum(p.cartons)} thùng · {fmtKg(p.weight)} · {fmtDec(calcPartCbm(p), 3)} m³
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 hidden sm:block">
                        Sức chứa tham chiếu: {fmtNum(fit.total)} thùng
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onUnassign(p.id)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Tổng: {fmtNum(stats.totalCartons)} thùng · {fmtNum(stats.totalQty)} PCS</span>
          <span className={cn('font-semibold', utilColor(stats.cbmPct).text)}>
            {fmtDec(stats.cbmPct, 1)}% CBM
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Sơ đồ kệ =====
function RackVisual({ stats, maxCbm }) {
  const parts = stats.parts;
  if (parts.length === 0) {
    return (
      <div className="h-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-300">
        Trống
      </div>
    );
  }

  return (
    <div className="relative h-16 rounded-lg border border-slate-200 overflow-hidden flex bg-slate-50">
      {parts.map((p) => {
        const cbm = calcPartCbm(p);
        const pct = Math.min((cbm / maxCbm) * 100, 100);
        return (
          <div
            key={p.id}
            className="h-full flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden transition-all"
            style={{ width: `${pct}%`, background: p.color, minWidth: pct > 0.5 ? 'auto' : '2px' }}
            title={`${p.partName}: ${fmtDec(cbm, 2)} m³`}
          >
            {pct > 5 && p.partName}
          </div>
        );
      })}
      {stats.totalCbm > maxCbm && (
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold">
          VƯỢT {fmtDec(stats.totalCbm - maxCbm, 2)} m³
        </div>
      )}
    </div>
  );
}

// ===== Goods Overview Panel =====
// Summary card showing how well all goods fit into the allocated racks.
function GoodsOverviewPanel({ parts, racks }) {
  const totalCartons = parts.reduce((s, p) => s + (p.cartons || 0), 0);
  const totalCbm = parts.reduce((s, p) => s + calcPartCbm(p), 0);
  const totalWeight = parts.reduce((s, p) => s + (p.weight || 0), 0);
  const unallocated = parts.filter((p) => !p.rackId);
  const allocatedCartons = parts.filter((p) => p.rackId).reduce((s, p) => s + (p.cartons || 0), 0);

  if (parts.length === 0) return null;

  const rackSummaries = racks.map((c) => {
    const assigned = parts.filter((p) => p.rackId === c.id);
    const cbm = assigned.reduce((s, p) => s + calcPartCbm(p), 0);
    const weight = assigned.reduce((s, p) => s + (p.weight || 0), 0);
    const cartons = assigned.reduce((s, p) => s + (p.cartons || 0), 0);
    const cbmPct = c.maxCbm ? (cbm / c.maxCbm) * 100 : 0;
    const weightPct = c.maxWeight ? (weight / c.maxWeight) * 100 : 0;
    const overCbm = cbm > c.maxCbm;
    const overWeight = weight > c.maxWeight;
    return { c, cbm, weight, cartons, cbmPct, weightPct, overCbm, overWeight };
  });

  const anyOverload = rackSummaries.some((s) => s.overCbm || s.overWeight);
  const allFit = unallocated.length === 0 && !anyOverload && racks.length > 0;

  return (
    <Card className={cn(
      'border',
      allFit ? 'border-emerald-200 bg-emerald-50/30' :
      anyOverload ? 'border-red-200 bg-red-50/20' :
      unallocated.length > 0 ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200',
    )}>
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
            <Package className="w-4 h-4" />
            Tổng quan hàng hóa
          </CardTitle>
          <div className="flex items-center gap-2">
            {allFit && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Tất cả hàng vừa kệ
              </Badge>
            )}
            {anyOverload && (
              <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                <AlertTriangle className="w-3 h-3" /> Quá tải — cần thêm kệ
              </Badge>
            )}
            {!allFit && !anyOverload && unallocated.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                <Info className="w-3 h-3" /> Còn {unallocated.length} PART chưa phân bổ
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-3">
        {/* ── Totals row ── */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-lg border border-slate-100 py-2 px-3">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Tổng thùng</p>
            <p className="text-lg font-bold text-slate-800">{fmtNum(totalCartons)}</p>
            <p className="text-[11px] text-slate-400">{fmtNum(allocatedCartons)} đã phân bổ</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-100 py-2 px-3">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Tổng CBM</p>
            <p className="text-lg font-bold text-slate-800">{fmtDec(totalCbm, 2)} m³</p>
            <p className="text-[11px] text-slate-400">{racks.length} kệ</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-100 py-2 px-3">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Tổng KG</p>
            <p className="text-lg font-bold text-slate-800">{fmtNum(Math.round(totalWeight))}</p>
            <p className="text-[11px] text-slate-400">{parts.length} PART</p>
          </div>
        </div>

        {/* ── Mức sử dụng từng kệ bars ── */}
        {rackSummaries.length > 0 && (
          <div className="space-y-2">
            {rackSummaries.map(({ c, cbm, weight, cartons, cbmPct, weightPct, overCbm, overWeight }) => (
              <div key={c.id} className={cn(
                'rounded-lg border px-4 py-3 space-y-2',
                overCbm || overWeight ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-white',
              )}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{c.name}</span>
                  <span className="text-slate-400">{c.type} · {fmtNum(cartons)} thùng</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                      <span>CBM: {fmtDec(cbm, 2)} / {c.maxCbm} m³</span>
                      <span className={cn('font-semibold', overCbm ? 'text-red-600' : utilColor(cbmPct).text)}>
                        {fmtDec(cbmPct, 1)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', overCbm ? 'bg-red-500' : utilColor(cbmPct).bg)}
                        style={{ width: `${Math.min(cbmPct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                      <span>KG: {fmtNum(Math.round(weight))} / {fmtNum(c.maxWeight)}</span>
                      <span className={cn('font-semibold', overWeight ? 'text-red-600' : utilColor(weightPct).text)}>
                        {fmtDec(weightPct, 1)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', overWeight ? 'bg-red-500' : utilColor(weightPct).bg)}
                        style={{ width: `${Math.min(weightPct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                {(overCbm || overWeight) && (
                  <p className="text-[10px] text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {overCbm && `Vượt CBM ${fmtDec(cbm - c.maxCbm, 2)} m³`}
                    {overCbm && overWeight && ' · '}
                    {overWeight && `Vượt KG ${fmtNum(Math.round(weight - c.maxWeight))}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {unallocated.length > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ Còn <strong>{unallocated.length} PART</strong> ({fmtDec(unallocated.reduce((s, p) => s + calcPartCbm(p), 0), 2)} m³ · {fmtNum(Math.round(unallocated.reduce((s, p) => s + (p.weight || 0), 0)))} kg) chưa được phân bổ vào kệ nào.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
