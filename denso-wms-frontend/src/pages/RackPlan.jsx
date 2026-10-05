import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, PlayCircle, AlertTriangle, Download, Search, Warehouse, MapPin, Boxes, Weight, MoveRight, ShieldCheck, Upload } from 'lucide-react';
import RackScene3D from '@/components/viz/RackScene3D';
import RackLevelView from '@/components/viz/RackLevelView';
import { buildRackLayout } from '@/lib/viz/rackLayout';
import { divisionColor } from '@/lib/viz/divisionColors';
import { RACK_SAFETY, LOAD_STATUS_META, loadPercent, loadStatus } from '@/lib/viz/rackSafety';
import { fmtDec, fmtNum } from '@/lib/calculations';
import ImportDialog from '@/components/ImportDialog';

const COLOR_MODE_PART = '__part__';
const COLOR_MODE_ALL_DIVISION = '__all_division__';

function placementWeight(p, partsById) {
  const part = partsById[p.partId];
  if (!part?.cartons) return 0;
  return Number(part.weight || 0) / Number(part.cartons || 1);
}

export default function RackPlan() {
  const { rackId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { racks, parts, orders, divisions, assignPart } = useStore();
  const { toast } = useToast();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [solving, setSolving] = useState(false);
  const [visibleLevel, setVisibleLevel] = useState('all');
  const [colorMode, setColorMode] = useState(COLOR_MODE_PART);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [selectedSlotCode, setSelectedSlotCode] = useState(null);
  const [moving, setMoving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const rack = racks.find((r) => r.id === rackId);
  const rackOrder = orders.find((o) => o.id === rack?.orderId);
  const rackParts = useMemo(() => parts.filter((p) => p.rackId === rackId), [parts, rackId]);
  const partsById = useMemo(() => Object.fromEntries(parts.map((p) => [p.id, p])), [parts]);

  const getColor = useCallback((p) => {
    if (colorMode === COLOR_MODE_PART) return p.colorHex;
    return divisionColor(partsById[p.partId]?.divisionCode);
  }, [colorMode, partsById]);

  const isDimmed = useCallback((p) => {
    if (colorMode === COLOR_MODE_PART || colorMode === COLOR_MODE_ALL_DIVISION) return false;
    return partsById[p.partId]?.divisionCode !== colorMode;
  }, [colorMode, partsById]);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.storage.plan(rackId);
      setPlan(data);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [rackId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  const handleSolve = async () => {
    setSolving(true);
    try {
      const data = await api.storage.solve(rackId);
      setPlan(data);
      toast({ title: 'Đã tối ưu phân bổ vị trí', description: `${data.placements.length} thùng đã được bố trí theo giới hạn tải trọng` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Không thể tính toán', description: err.message });
    } finally {
      setSolving(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.storage.exportXlsx(rackId);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vi-tri-kho-${rack?.name || rackId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Xuất Excel thất bại', description: err.message });
    }
  };

  const handleRackImported = async (_orderId, result) => {
    try {
      const data = await api.storage.solve(rackId);
      setPlan(data);
      const inserted = result?.insertedPartCount ?? result?.partCount ?? 0;
      toast({
        title: `Đã đưa hàng vào ${rack?.name || 'kệ'}`,
        description: `${inserted} PART mới đã được gán vào kệ và tối ưu vị trí S01–S20.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Đã nhập PART nhưng chưa tối ưu được vị trí',
        description: err.message,
      });
    }
  };

  const layout = useMemo(() => buildRackLayout(plan?.placements || []), [plan]);

  const slotMetrics = useMemo(() => {
    const result = {};
    for (const slot of layout.slots) {
      const weightKg = slot.placements.reduce((sum, p) => sum + placementWeight(p, partsById), 0);
      const partIds = [...new Set(slot.placements.map((p) => p.partId))];
      const partNames = partIds.map((id) => partsById[id]?.partName).filter(Boolean);
      result[slot.code] = {
        code: slot.code,
        level: slot.level,
        bay: slot.bay,
        weightKg,
        maxKg: RACK_SAFETY.slotMaxKg,
        percent: loadPercent(weightKg, RACK_SAFETY.slotMaxKg),
        status: loadStatus(weightKg, RACK_SAFETY.slotMaxKg),
        cartonCount: slot.placements.length,
        partIds,
        partNames,
      };
    }
    return result;
  }, [layout.slots, partsById]);

  const levelMetrics = useMemo(() => [1, 2, 3, 4].map((level) => {
    const weightKg = layout.slots
      .filter((s) => s.level === level)
      .reduce((sum, s) => sum + (slotMetrics[s.code]?.weightKg || 0), 0);
    return {
      level,
      weightKg,
      maxKg: RACK_SAFETY.levelMaxKg,
      percent: loadPercent(weightKg, RACK_SAFETY.levelMaxKg),
      status: loadStatus(weightKg, RACK_SAFETY.levelMaxKg),
    };
  }), [layout.slots, slotMetrics]);

  const rackWeight = Number(plan?.weightUsedKg || 0);
  const rackLoadStatus = loadStatus(rackWeight, RACK_SAFETY.rackMaxKg);
  const rackLoadPct = loadPercent(rackWeight, RACK_SAFETY.rackMaxKg);
  const alertSlots = Object.values(slotMetrics).filter((m) => m.status === 'near' || m.status === 'overload').length;
  const alertLevels = levelMetrics.filter((m) => m.status === 'near' || m.status === 'overload').length;

  const highlightedPartIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set();
    return new Set(
      rackParts
        .filter((p) =>
          p.partName?.toLowerCase().includes(q) ||
          p.productCode?.toLowerCase().includes(q) ||
          p.masterPo?.toLowerCase().includes(q),
        )
        .map((p) => p.id),
    );
  }, [search, rackParts]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const ids = highlightedPartIds;
    return layout.slots
      .filter((s) => s.placements.some((p) => ids.has(p.partId)))
      .map((s) => ({ slot: s, part: partsById[s.placements[0]?.partId] }))
      .filter((x) => x.part);
  }, [search, highlightedPartIds, layout.slots, partsById]);

  useEffect(() => {
    if (searchResults.length === 1) setSelectedSlotCode(searchResults[0].slot.code);
  }, [searchResults]);

  const selectedSlot = layout.slots.find((s) => s.code === selectedSlotCode) || null;
  const selectedPartIds = [...new Set((selectedSlot?.placements || []).map((p) => p.partId))];
  const selectedParts = selectedPartIds.map((id) => partsById[id]).filter(Boolean);
  const selectedMetric = selectedSlot ? slotMetrics[selectedSlot.code] : null;
  const usedSlots = layout.slots.filter((s) => s.placements.length > 0).length;
  const slotPct = (usedSlots / 20) * 100;

  const handleMovePart = async (partId, targetCode) => {
    const target = layout.slots.find((s) => s.code === targetCode);
    if (!target) return;
    setMoving(true);
    try {
      const sourceCode = selectedSlotCode;
      await assignPart(partId, rackId, target.index);
      const data = await api.storage.solve(rackId);
      setPlan(data);
      const solvedLayout = buildRackLayout(data.placements || []);
      const actualSlot = solvedLayout.slots.find((s) => s.placements.some((p) => p.partId === partId));
      setSelectedSlotCode(actualSlot?.code || targetCode);
      toast({
        title: actualSlot?.code === targetCode ? 'Đã điều chuyển vị trí' : 'Đã tính lại vị trí an toàn',
        description: actualSlot?.code === targetCode
          ? `${sourceCode || 'Vị trí cũ'} → ${targetCode}. Lịch sử điều chuyển đã được ghi.`
          : `${targetCode} không đáp ứng giới hạn tải; hệ thống bố trí PART tại ${actualSlot?.code || 'vị trí phù hợp khác'}.`,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Không thể chuyển ô', description: err.message });
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1500px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/racks')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-900">{rack?.name || 'Kệ kho'}</h1>
              <Badge variant="secondary">20 ô · 5×4</Badge>
              <Badge className={LOAD_STATUS_META[rackLoadStatus].badge}>{LOAD_STATUS_META[rackLoadStatus].label}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5" /> {rack?.warehouseCode || 'DENSO-WH'}
              <span>·</span><MapPin className="w-3.5 h-3.5" /> {rack?.zoneCode || 'ZONE-A'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!plan}>
            <Download className="w-4 h-4 mr-1.5" /> Xuất Excel vị trí
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!rack?.orderId}>
            <Upload className="w-4 h-4 mr-1.5" /> Nhập hàng vào {rack?.name || 'kệ'}
          </Button>
          <Button onClick={handleSolve} disabled={solving}>
            {solving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-1.5" />}
            Tối ưu phân bổ vị trí
          </Button>
        </div>
      </div>

      {loading && <Card><CardContent className="py-12 text-center text-sm text-slate-400">Đang tải...</CardContent></Card>}

      {!loading && !plan && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-slate-400 space-y-3">
            <Warehouse className="w-10 h-10 mx-auto text-slate-300" />
            <p>Kệ chưa có sơ đồ vị trí. Nhấn “Tối ưu phân bổ vị trí” để tạo bố trí S01–S20.</p>
          </CardContent>
        </Card>
      )}

      {!loading && plan && (
        <>
          {plan.violations?.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="py-3 space-y-1.5">
                {plan.violations.map((v, i) => (
                  <div key={`${v.code}-${i}`} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className={v.severity === 'error' ? 'w-3.5 h-3.5 text-red-500 mt-0.5' : 'w-3.5 h-3.5 text-amber-500 mt-0.5'} />
                    <span className={v.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>{v.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniStat icon={Boxes} label="Ô đang dùng" value={`${usedSlots}/20`} sub={`${fmtDec(slotPct, 1)}%`} />
            <MiniStat icon={Warehouse} label="Ô còn trống" value={20 - usedSlots} sub="S01–S20" />
            <MiniStat icon={Weight} label="Tải trọng kệ" value={`${fmtNum(rackWeight)} kg`} sub={`${fmtDec(rackLoadPct, 1)}% / 10.000 kg`} status={rackLoadStatus} />
            <MiniStat icon={AlertTriangle} label="Cảnh báo tải" value={alertSlots + alertLevels} sub={`${alertSlots} ô · ${alertLevels} tầng`} status={alertSlots + alertLevels ? 'near' : 'active'} />
            <MiniStat icon={ShieldCheck} label="Giới hạn an toàn" value="500 kg/ô" sub="2.000 kg/tầng" />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tải trọng theo tầng</CardTitle>
              <p className="text-xs text-slate-400">Ngưỡng cảnh báo từ 80% · hệ thống không xếp vượt 500 kg/ô, 2.000 kg/tầng và 10.000 kg/kệ</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {levelMetrics.map((m) => {
                  const meta = LOAD_STATUS_META[m.status];
                  return (
                    <div key={m.level} className="rounded-xl border p-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-slate-700">Tầng {m.level}</p>
                        <Badge className={meta.badge}>{meta.label}</Badge>
                      </div>
                      <div className="mt-3 flex justify-between text-xs"><span className="text-slate-400">{fmtDec(m.weightKg, 1)} kg</span><span className="font-semibold">{fmtDec(m.percent, 1)}%</span></div>
                      <Progress value={Math.min(m.percent, 100)} className="h-1.5 mt-1.5" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="relative min-w-[280px] flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên linh kiện, mã hàng, Master PO..." className="pl-9" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-500">Hiển thị đến tầng:</span>
                  <Button size="sm" variant={visibleLevel === 'all' ? 'default' : 'outline'} onClick={() => setVisibleLevel('all')}>Tất cả</Button>
                  {[1,2,3,4].map((l) => <Button key={l} size="sm" variant={visibleLevel === l ? 'default' : 'outline'} onClick={() => setVisibleLevel(l)}>{l}</Button>)}
                </div>
                <Select value={colorMode} onValueChange={setColorMode}>
                  <SelectTrigger className="w-[210px] h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={COLOR_MODE_PART}>Màu theo PART</SelectItem>
                    <SelectItem value={COLOR_MODE_ALL_DIVISION}>Màu theo Division</SelectItem>
                    {divisions.map((d) => <SelectItem key={d.code} value={d.code}>Chỉ {d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {searchResults.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {searchResults.map(({ slot, part }) => (
                    <button key={`${slot.code}-${part.id}`} type="button" onClick={() => setSelectedSlotCode(slot.code)} className="text-xs rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 px-3 py-1.5 hover:bg-indigo-100">
                      {slot.code} · {part.partName}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                {Object.entries(LOAD_STATUS_META).map(([key, meta]) => (
                  <span key={key} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: meta.color }} />{meta.label}</span>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
                <RackScene3D
                  placements={layout.placements}
                  slots={layout.slots}
                  slotMetrics={slotMetrics}
                  visibleLevel={visibleLevel}
                  className="rounded-xl overflow-hidden border"
                  getColor={getColor}
                  isDimmed={isDimmed}
                  highlightedPartIds={highlightedPartIds}
                  selectedSlotCode={selectedSlotCode}
                  onSelectSlot={setSelectedSlotCode}
                  rackId={rack?.id}
                  rackName={rack?.name}
                />
                <SlotDetail
                  slot={selectedSlot}
                  parts={selectedParts}
                  metric={selectedMetric}
                  allSlots={layout.slots}
                  moving={moving}
                  onMovePart={handleMovePart}
                />
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-3">Sơ đồ vị trí từng tầng</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1,2,3,4].map((level) => (
                <RackLevelView key={level} level={level} slots={layout.slots} partsById={partsById} selectedSlotCode={selectedSlotCode} onSelectSlot={setSelectedSlotCode} />
              ))}
            </div>
          </div>
        </>
      )}

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        targetOrderId={rack?.orderId}
        targetOrderLabel={rackOrder?.name || rackOrder?.orderNumber || 'Lô linh kiện'}
        targetRackId={rackId}
        targetRackLabel={rack?.name || 'Kệ kho'}
        onImported={handleRackImported}
      />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub, status }) {
  const meta = status ? LOAD_STATUS_META[status] : null;
  return (
    <Card><CardContent className="py-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: meta ? `${meta.color}18` : '#eef2ff' }}><Icon className="w-4 h-4" style={{ color: meta?.color || '#4f46e5' }} /></div>
      <div className="min-w-0"><p className="text-[11px] text-slate-400 truncate">{label}</p><p className="font-bold text-slate-800">{value}</p><p className="text-[10px] text-slate-400 truncate">{sub}</p></div>
    </CardContent></Card>
  );
}

function SlotDetail({ slot, parts, metric, allSlots, moving, onMovePart }) {
  if (!slot) {
    return (
      <Card className="h-full"><CardContent className="h-full min-h-[300px] flex items-center justify-center text-center text-sm text-slate-400 p-8">
        Click hoặc hover một ô S01–S20 trên mô hình 3D để xem tải trọng và linh kiện.
      </CardContent></Card>
    );
  }

  const occupied = slot.placements.length > 0;
  const primaryPart = parts[0];
  const availableTargets = allSlots.filter((s) => s.code === slot.code || s.placements.length === 0);
  const status = metric?.status || 'empty';
  const meta = LOAD_STATUS_META[status];
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div><CardTitle className="text-lg">Ô {slot.code}</CardTitle><p className="text-xs text-slate-400 mt-1">Tầng {slot.level} · Khoang {slot.bay}</p></div>
          <Badge className={meta.badge}>{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3">
          <div className="flex justify-between text-xs"><span className="text-slate-500">Tải trọng ô</span><strong>{fmtDec(metric?.weightKg || 0, 1)} / {RACK_SAFETY.slotMaxKg} kg</strong></div>
          <Progress value={Math.min(metric?.percent || 0, 100)} className="h-2 mt-2" />
          <p className="text-[10px] text-slate-400 mt-1.5">Cảnh báo khi đạt ≥ {RACK_SAFETY.nearRatio * 100}%.</p>
        </div>

        {!occupied ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">Ô này đang trống và sẵn sàng lưu linh kiện.</div>
        ) : (
          <>
            <div className="space-y-2">
              {parts.map((p) => (
                <div key={p.id} className="rounded-lg border p-3 bg-slate-50">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: p.color }} /><p className="font-semibold text-sm text-slate-800">{p.partName}</p></div>
                  <p className="text-xs text-slate-500 mt-1">{p.productCode || 'Không có mã'} · PO {p.masterPo}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-400">Số thùng trong ô</p><p className="font-bold text-slate-800 mt-1">{metric?.cartonCount || 0}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-400">Mức sử dụng tải</p><p className="font-bold text-slate-800 mt-1">{fmtDec(metric?.percent || 0, 1)}%</p></div>
            </div>
            {primaryPart && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-600 flex items-center gap-1"><MoveRight className="w-3.5 h-3.5" /> Điều chuyển PART sang ô khác</p>
                <Select value={slot.code} onValueChange={(code) => code !== slot.code && onMovePart(primaryPart.id, code)} disabled={moving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableTargets.map((s) => <SelectItem key={s.code} value={s.code}>{s.code} · Tầng {s.level} / Khoang {s.bay}{s.code === slot.code ? ' (hiện tại)' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-400">Hệ thống kiểm tra lại tải trọng và ghi lịch sử vị trí cũ → vị trí mới.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
