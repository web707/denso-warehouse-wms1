import { useEffect, useMemo, useRef, useState } from 'react';
import { SLOTS_PER_RACK, slotCode, slotPosition, summarizeRack, zoneShort } from '@/lib/warehouse';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  CheckSquare2,
  Download,
  FileDown,
  Layers3,
  Package,
  Printer,
  QrCode,
  Search,
  Square,
  Warehouse,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildRackLayout } from '@/lib/viz/rackLayout';
import { LOAD_STATUS_META, RACK_SAFETY, loadStatus } from '@/lib/viz/rackSafety';

const WAREHOUSE_CODE = 'DENSO-WH';
const LABEL_PRESETS = {
  small: { label: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  medium: { label: '70 × 40 mm', widthMm: 70, heightMm: 40 },
  large: { label: '100 × 60 mm', widthMm: 100, heightMm: 60 },
  a4: { label: 'A4 · nhiều tem', widthMm: 90, heightMm: 55, a4: true },
};
const TYPES = [
  { value: 'zone', label: 'QR Zone', icon: Layers3 },
  { value: 'rack', label: 'QR Kệ', icon: Warehouse },
  { value: 'slot', label: 'QR Ô', icon: QrCode },
  { value: 'part', label: 'QR PART', icon: Package },
];
const STATUS_ORDER = ['all', 'empty', 'active', 'near', 'full', 'overload'];
const STATUS_LABEL = {
  all: 'Tất cả trạng thái',
  empty: 'Trống',
  active: 'Đang sử dụng',
  near: 'Gần đầy',
  full: 'Đầy tải',
  overload: 'Quá tải',
};

const safeText = (value) => String(value || '').trim();

function placementWeight(placement, partsById) {
  const part = partsById[placement.partId];
  if (!part?.cartons) return 0;
  return Number(part.weight || 0) / Math.max(1, Number(part.cartons || 1));
}

function labelStatusClass(status) {
  return {
    empty: 'border-slate-200 bg-white',
    active: 'border-emerald-200 bg-emerald-50/30',
    near: 'border-amber-300 bg-amber-50/40',
    full: 'border-indigo-300 bg-indigo-50/40',
    overload: 'border-red-300 bg-red-50/40',
  }[status] || 'border-slate-200 bg-white';
}

function statusDot(status) {
  return {
    empty: '#94a3b8',
    active: '#22c55e',
    near: '#f59e0b',
    full: '#6366f1',
    overload: '#ef4444',
  }[status] || '#94a3b8';
}

function MiniStat({ icon: Icon, label, value, sub }) {
  return <div className="rounded-xl border bg-white px-4 py-3 flex gap-3 items-center">
    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-4 h-4" /></div>
    <div className="min-w-0"><div className="text-lg font-bold text-slate-900">{value}</div><div className="text-xs text-slate-500">{label}</div>{sub && <div className="text-[10px] text-slate-400 truncate">{sub}</div>}</div>
  </div>;
}

function LabelCard({ item, selected, onToggle, onPreview }) {
  const meta = LOAD_STATUS_META[item.status] || LOAD_STATUS_META.empty;
  return <div className={`qr-label-card relative rounded-xl border p-3 cursor-pointer transition hover:shadow-sm ${labelStatusClass(item.status)} ${selected ? 'ring-2 ring-indigo-400' : ''}`} onClick={() => onPreview(item.key)}>
    <button type="button" className="absolute top-2 left-2 z-10 w-6 h-6 rounded-md bg-white/95 border flex items-center justify-center" onClick={(e) => { e.stopPropagation(); onToggle(item.key); }} aria-label="Chọn nhãn">
      {selected ? <CheckSquare2 className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-400" />}
    </button>
    <div className="flex justify-center"><QRCodeSVG value={item.qrValue} size={92} /></div>
    <div className="font-bold text-center mt-2 truncate">{item.title}</div>
    <div className="text-[10px] text-center text-slate-500 truncate">{item.subtitle}</div>
    <div className="mx-auto overflow-hidden max-w-[150px] mt-1"><Barcode value={item.barcodeValue} height={20} width={0.85} displayValue={false} margin={0} /></div>
    {item.status && <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold" style={{ color: meta.color }}><span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />{meta.label}</div>}
  </div>;
}

function PrintableLabel({ item, preset, pdfKey }) {
  const meta = LOAD_STATUS_META[item.status] || LOAD_STATUS_META.empty;
  const narrow = preset.widthMm <= 50;
  return <div
    data-pdf-key={pdfKey || item.key}
    className="print-label bg-white border border-slate-300 rounded-md overflow-hidden box-border"
    style={{ width: `${preset.widthMm}mm`, height: `${preset.heightMm}mm`, padding: narrow ? '2mm' : '3mm' }}
  >
    <div className="h-full flex gap-2 items-center">
      <QRCodeSVG value={item.qrValue} size={narrow ? 70 : 92} />
      <div className="min-w-0 flex-1">
        <div className="text-[7px] uppercase tracking-wide text-slate-400">{item.kindLabel}</div>
        <div className={`${narrow ? 'text-sm' : 'text-lg'} font-bold leading-tight truncate`}>{item.title}</div>
        <div className="text-[8px] text-slate-500 truncate">{item.subtitle}</div>
        {item.detail && <div className="text-[7px] text-slate-600 mt-0.5 line-clamp-2">{item.detail}</div>}
        <div className="overflow-hidden mt-1"><Barcode value={item.barcodeValue} height={narrow ? 15 : 22} width={0.75} displayValue={false} margin={0} /></div>
        {item.status && <div className="text-[7px] font-bold flex items-center gap-1 mt-0.5" style={{ color: meta.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}</div>}
      </div>
    </div>
  </div>;
}

export default function QRLabels() {
  const { racks, parts } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const pdfRootRef = useRef(null);
  const [zones, setZones] = useState([]);
  const [type, setType] = useState('slot');
  const [zoneCode, setZoneCode] = useState(() => racks[0]?.zoneCode || 'ZONE-A');
  const [rackId, setRackId] = useState(() => racks[0]?.id || '');
  const [level, setLevel] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [presetKey, setPresetKey] = useState('medium');
  const [selected, setSelected] = useState(new Set());
  const [previewKey, setPreviewKey] = useState('');
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printedCount, setPrintedCount] = useState(() => Number(localStorage.getItem('wms_qr_labels_printed') || 0));

  const publicBase = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
  const localOnly = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const preset = LABEL_PRESETS[presetKey];

  useEffect(() => {
    api.zones.list({ warehouseCode: WAREHOUSE_CODE }).then(setZones).catch(() => setZones([]));
  }, []);

  const zoneRacks = useMemo(() => racks.filter((r) => (r.warehouseCode || WAREHOUSE_CODE) === WAREHOUSE_CODE && (r.zoneCode || 'ZONE-A') === zoneCode), [racks, zoneCode]);

  useEffect(() => {
    if (!zoneRacks.length) { setRackId(''); return; }
    const valid = zoneRacks.some((r) => r.id === rackId);
    if (!valid) setRackId(type === 'slot' ? zoneRacks[0].id : '');
    if (type === 'slot' && !rackId) setRackId(zoneRacks[0].id);
  }, [zoneRacks, rackId, type]);

  const rack = useMemo(() => racks.find((r) => r.id === rackId) || null, [racks, rackId]);
  const rackParts = useMemo(() => parts.filter((p) => p.rackId === rackId), [parts, rackId]);
  const partsById = useMemo(() => Object.fromEntries(parts.map((p) => [p.id, p])), [parts]);

  useEffect(() => {
    if (!rackId) { setPlan(null); return; }
    let cancelled = false;
    setLoadingPlan(true);
    api.storage.plan(rackId)
      .then((data) => { if (!cancelled) setPlan(data); })
      .catch(() => { if (!cancelled) setPlan(null); })
      .finally(() => { if (!cancelled) setLoadingPlan(false); });
    return () => { cancelled = true; };
  }, [rackId]);

  const layout = useMemo(() => buildRackLayout(plan?.placements || []), [plan]);

  const slotItems = useMemo(() => Array.from({ length: SLOTS_PER_RACK }, (_, index) => {
    const code = slotCode(index);
    const layoutSlot = layout.slots.find((s) => s.index === index);
    const placementIds = [...new Set((layoutSlot?.placements || []).map((p) => p.partId))];
    const fallbackParts = rackParts.filter((p) => p.preferredRackSlot === index);
    const slotParts = placementIds.length ? placementIds.map((id) => partsById[id]).filter(Boolean) : fallbackParts;
    const cartonCount = layoutSlot?.placements?.length || slotParts.reduce((s, p) => s + Number(p.cartons || 0), 0);
    const weightKg = layoutSlot?.placements?.length
      ? layoutSlot.placements.reduce((s, p) => s + placementWeight(p, partsById), 0)
      : slotParts.reduce((s, p) => s + Number(p.weight || 0), 0);
    const load = loadStatus(weightKg, RACK_SAFETY.slotMaxKg);
    const firstPart = slotParts[0];
    const fullCode = `${zoneShort(rack?.zoneCode)}-${rack?.name || 'RACK'}-${code}`;
    return {
      key: `slot:${rackId}:${index}`,
      kind: 'slot', kindLabel: 'Ô lưu trữ', title: `${rack?.name || 'RACK'}-${code}`,
      subtitle: `${rack?.warehouseCode || WAREHOUSE_CODE} / ${rack?.zoneCode || zoneCode} · Tầng ${Math.floor(index / 5) + 1} · Khoang ${(index % 5) + 1}`,
      code: fullCode,
      barcodeValue: fullCode,
      qrValue: `${publicBase}/locations/${rackId}/${code}`,
      status: load,
      level: slotPosition(index).level,
      index,
      weightKg,
      cartonCount,
      partCount: slotParts.length,
      part: firstPart,
      detail: firstPart ? `${firstPart.partName} · ${firstPart.productCode || firstPart.masterPo} · ${cartonCount} thùng · ${weightKg.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kg` : 'Ô trống',
    };
  }), [layout.slots, rackParts, partsById, rack, rackId, publicBase, zoneCode]);

  const rackItems = useMemo(() => zoneRacks.map((r) => {
    const sum = summarizeRack(r, parts);
    const rp = sum.parts;
    const usedSlots = sum.usedSlots;
    const weightKg = sum.totalWeight;
    const st = sum.status;
    const code = `${zoneShort(r.zoneCode)}-${r.name}`;
    return { key: `rack:${r.id}`, kind: 'rack', kindLabel: 'Kệ kho', title: r.name, subtitle: `${r.warehouseCode} / ${r.zoneCode}`, code, barcodeValue: code, qrValue: `${publicBase}/racks/${r.id}/plan`, status: st, detail: `${usedSlots}/${SLOTS_PER_RACK} ô · ${rp.length} PART · ${weightKg.toLocaleString('vi-VN')} kg`, rack: r };
  }), [zoneRacks, parts, publicBase]);

  const zoneItems = useMemo(() => (zones.length ? zones : [...new Set(racks.map((r) => r.zoneCode))].filter(Boolean).map((code) => ({ code, name: code }))).map((z) => {
    const zr = racks.filter((r) => r.zoneCode === z.code);
    const ids = new Set(zr.map((r) => r.id));
    const zp = parts.filter((p) => ids.has(p.rackId));
    const code = `${WAREHOUSE_CODE}-${z.code}`;
    return { key: `zone:${z.code}`, kind: 'zone', kindLabel: 'Khu kho', title: z.code, subtitle: `${WAREHOUSE_CODE} · ${z.name || 'Khu lưu trữ'}`, code, barcodeValue: code, qrValue: `${publicBase}/racks?zone=${encodeURIComponent(z.code)}`, status: zp.length ? 'active' : 'empty', detail: `${zr.length} kệ · ${zp.length} PART` };
  }), [zones, racks, parts, publicBase]);

  const partItems = useMemo(() => {
    const zoneRackIds = new Set(zoneRacks.map((r) => r.id));
    return parts.filter((p) => zoneRackIds.has(p.rackId) && (!rackId || p.rackId === rackId)).map((p) => {
      const pr = racks.find((r) => r.id === p.rackId);
      const sIndex = Number.isInteger(p.preferredRackSlot) ? p.preferredRackSlot : null;
      const loc = sIndex === null ? 'Chưa có ô ưu tiên' : `${pr?.name}-${slotCode(sIndex)}`;
      const code = p.productCode || p.masterPo || p.id;
      return { key: `part:${p.id}`, kind: 'part', kindLabel: 'Linh kiện / PART', title: p.partName, subtitle: `${code} · ${pr?.zoneCode || zoneCode} / ${loc}`, code, barcodeValue: code, qrValue: `${publicBase}/racks/${p.rackId}/plan?q=${encodeURIComponent(p.productCode || p.partName || p.masterPo || '')}`, status: p.rackId ? 'active' : 'empty', detail: `${p.cartons || 0} thùng · ${Number(p.weight || 0).toLocaleString('vi-VN')} kg`, part: p };
    });
  }, [zoneRacks, parts, racks, rackId, publicBase, zoneCode]);

  const rawItems = type === 'zone' ? zoneItems : type === 'rack' ? rackItems : type === 'part' ? partItems : slotItems;
  const query = search.trim().toLowerCase();
  const filteredItems = useMemo(() => rawItems.filter((item) => {
    if (type === 'slot' && level !== 'all' && item.level !== Number(level)) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (!query) return true;
    return [item.title, item.subtitle, item.code, item.detail].some((v) => safeText(v).toLowerCase().includes(query));
  }), [rawItems, type, level, status, query]);

  useEffect(() => {
    setSelected(new Set(filteredItems.map((i) => i.key)));
    setPreviewKey(filteredItems[0]?.key || '');
  }, [type, zoneCode, rackId, level, status]); // intentionally not search

  const preview = filteredItems.find((i) => i.key === previewKey) || filteredItems[0] || null;
  const selectedItems = filteredItems.filter((i) => selected.has(i.key));
  const usedSlotsInZone = useMemo(
    () => zoneRacks.reduce((sum, r) => sum + summarizeRack(r, parts).usedSlots, 0),
    [zoneRacks, parts],
  );

  const toggleSelected = (key) => setSelected((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const selectAll = () => setSelected(new Set(filteredItems.map((i) => i.key)));
  const clearSelected = () => setSelected(new Set());
  const rememberPrinted = (count) => { const next = printedCount + count; setPrintedCount(next); localStorage.setItem('wms_qr_labels_printed', String(next)); };

  const handlePrint = () => {
    if (!selectedItems.length) { toast({ variant: 'destructive', title: 'Chưa chọn nhãn', description: 'Hãy chọn ít nhất một nhãn trước khi in.' }); return; }
    rememberPrinted(selectedItems.length);
    setTimeout(() => window.print(), 80);
  };

  const handleExportPdf = async () => {
    if (!selectedItems.length) { toast({ variant: 'destructive', title: 'Chưa chọn nhãn', description: 'Hãy chọn ít nhất một nhãn trước khi xuất PDF.' }); return; }
    const nodes = [...(pdfRootRef.current?.querySelectorAll('[data-pdf-key]') || [])];
    if (!nodes.length) return;
    setExporting(true);
    try {
      if (preset.a4) {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const positions = [[10, 12], [110, 12], [10, 79], [110, 79], [10, 146], [110, 146], [10, 213], [110, 213]];
        for (let i = 0; i < nodes.length; i += 1) {
          if (i > 0 && i % positions.length === 0) pdf.addPage();
          const canvas = await html2canvas(nodes[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
          const [x, y] = positions[i % positions.length];
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, 90, 55, undefined, 'FAST');
        }
        pdf.save(`QR-WMS-${zoneCode}-${Date.now()}.pdf`);
      } else {
        const pdf = new jsPDF({ orientation: preset.widthMm >= preset.heightMm ? 'landscape' : 'portrait', unit: 'mm', format: [preset.widthMm, preset.heightMm] });
        for (let i = 0; i < nodes.length; i += 1) {
          if (i > 0) pdf.addPage([preset.widthMm, preset.heightMm], preset.widthMm >= preset.heightMm ? 'landscape' : 'portrait');
          const canvas = await html2canvas(nodes[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 1.5, 1.5, preset.widthMm - 3, preset.heightMm - 3, undefined, 'FAST');
        }
        pdf.save(`QR-WMS-${zoneCode}-${Date.now()}.pdf`);
      }
      rememberPrinted(selectedItems.length);
      toast({ title: 'Đã xuất PDF nhãn', description: `${selectedItems.length} nhãn đã được tạo theo khổ ${preset.label}.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Xuất PDF thất bại', description: err.message });
    } finally { setExporting(false); }
  };

  return <div className="p-4 sm:p-6 md:p-8 max-w-[1550px] mx-auto space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">QR & Barcode kho</h1><p className="text-sm text-slate-500 mt-1">Quản lý nhãn Zone → Kệ → Ô → PART. Quét QR để mở đúng vị trí và thao tác kho nhanh.</p></div>
      <div className="flex gap-2 print:hidden"><Button variant="outline" onClick={handleExportPdf} disabled={exporting}>{exporting ? <Download className="w-4 h-4 mr-2 animate-pulse" /> : <FileDown className="w-4 h-4 mr-2" />}Xuất PDF</Button><Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />In nhãn</Button></div>
    </div>

    {localOnly && <div className="print:hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><b>Lưu ý khi quét bằng điện thoại:</b> hiện QR đang dùng địa chỉ <code>{window.location.origin}</code>. Khi chạy nội bộ qua điện thoại, đặt <code>VITE_PUBLIC_APP_URL=http://IP-MAY-CHU:4310</code> hoặc dùng domain triển khai để điện thoại mở được liên kết.</div>}

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
      <MiniStat icon={Warehouse} label="Kệ trong Zone" value={zoneRacks.length} sub={`${zoneCode} · tối đa 20 kệ`} />
      <MiniStat icon={Boxes} label="Ô đang dùng" value={usedSlotsInZone} sub={`${Math.max(0, zoneRacks.length * SLOTS_PER_RACK - usedSlotsInZone)} ô còn trống`} />
      <MiniStat icon={Package} label="PART trong Zone" value={parts.filter((p) => zoneRacks.some((r) => r.id === p.rackId)).length} />
      <MiniStat icon={QrCode} label="Nhãn đang chọn" value={selectedItems.length} sub={`${filteredItems.length} nhãn đang hiển thị`} />
      <MiniStat icon={Printer} label="Đã in / xuất" value={printedCount} sub="Trên trình duyệt này" />
    </div>

    <div id="qr-center-controls" className="print:hidden rounded-2xl border bg-white p-4 space-y-4">
      <div className="flex flex-wrap gap-2">{TYPES.map((t) => <button key={t.value} type="button" onClick={() => setType(t.value)} className={`h-10 px-4 rounded-lg border text-sm font-semibold flex items-center gap-2 ${type === t.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-white text-slate-600'}`}><t.icon className="w-4 h-4" />{t.label}</button>)}</div>
      <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
        <label className="text-xs text-slate-500">Zone<select className="mt-1 w-full h-10 rounded-md border px-3 bg-white" value={zoneCode} onChange={(e) => setZoneCode(e.target.value)}>{(zones.length ? zones : [...new Set(racks.map((r) => r.zoneCode))].filter(Boolean).map((code) => ({ code, name: code }))).map((z) => <option key={z.code} value={z.code}>{z.code} · {z.name}</option>)}</select></label>
        <label className="text-xs text-slate-500">Kệ<select className="mt-1 w-full h-10 rounded-md border px-3 bg-white" value={rackId} onChange={(e) => setRackId(e.target.value)} disabled={type === 'zone'}><option value="">Tất cả kệ</option>{zoneRacks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label className="text-xs text-slate-500">Tầng<select className="mt-1 w-full h-10 rounded-md border px-3 bg-white" value={level} onChange={(e) => setLevel(e.target.value)} disabled={type !== 'slot'}><option value="all">Tất cả tầng</option>{[1,2,3,4].map((v) => <option key={v} value={v}>Tầng {v}</option>)}</select></label>
        <label className="text-xs text-slate-500">Trạng thái<select className="mt-1 w-full h-10 rounded-md border px-3 bg-white" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
        <label className="text-xs text-slate-500">Khổ tem<select className="mt-1 w-full h-10 rounded-md border px-3 bg-white" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>{Object.entries(LABEL_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <div className="relative"><Search className="absolute left-3 top-1/2 translate-y-0.5 w-4 h-4 text-slate-400" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="R12, S08, PART, Master PO..." /></div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs"><div className="text-slate-500">{loadingPlan && type === 'slot' ? 'Đang tải trạng thái ô...' : `${filteredItems.length} nhãn phù hợp`}</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={selectAll}>Chọn tất cả</Button><Button size="sm" variant="ghost" onClick={clearSelected}>Bỏ chọn</Button></div></div>
    </div>

    <div className="print:hidden grid xl:grid-cols-[1fr_360px] gap-5 items-start">
      <div className="rounded-2xl border bg-white p-4">
        {filteredItems.length === 0 ? <div className="py-20 text-center text-slate-400">Không có nhãn phù hợp bộ lọc.</div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{filteredItems.map((item) => <LabelCard key={item.key} item={item} selected={selected.has(item.key)} onToggle={toggleSelected} onPreview={setPreviewKey} />)}</div>}
      </div>
      <div className="sticky top-5 rounded-2xl border bg-white p-5 min-h-[500px]">
        {!preview ? <div className="h-[450px] flex items-center justify-center text-center text-slate-400">Chọn một nhãn để xem trước.</div> : <>
          <div className="text-xs uppercase tracking-wide text-slate-400">Xem trước nhãn</div>
          <div className="mt-3 flex justify-center"><QRCodeSVG value={preview.qrValue} size={180} /></div>
          <div className="text-2xl font-semibold text-center mt-4">{preview.title}</div>
          <div className="text-xs text-center text-slate-500 mt-1">{preview.subtitle}</div>
          <div className="mt-3 overflow-hidden flex justify-center"><Barcode value={preview.barcodeValue} height={34} width={1.15} displayValue={false} /></div>
          <div className="mt-4 rounded-xl bg-slate-50 border p-3 text-sm"><div className="font-semibold">{preview.detail || 'Nhãn vị trí kho'}</div><div className="text-xs text-slate-400 font-mono break-all mt-2">{preview.code}</div>{preview.status && <div className="mt-2 flex items-center gap-2 text-xs font-semibold" style={{ color: statusDot(preview.status) }}><span className="w-2.5 h-2.5 rounded-full" style={{ background: statusDot(preview.status) }} />{STATUS_LABEL[preview.status]}</div>}</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {preview.kind === 'slot' && <Button variant="outline" onClick={() => navigate(`/locations/${rackId}/${slotCode(preview.index)}`)}>Mở chi tiết ô</Button>}
            {preview.kind === 'rack' && <Button variant="outline" onClick={() => navigate(`/racks/${preview.rack.id}/plan`)}>Mở kệ 3D</Button>}
            {preview.kind === 'zone' && <Button variant="outline" onClick={() => navigate(`/racks?zone=${encodeURIComponent(preview.title)}`)}>Mở mô hình Zone</Button>}
            {preview.kind === 'part' && <Button variant="outline" onClick={() => navigate(preview.qrValue.replace(publicBase, ''))}>Tìm PART trên kệ</Button>}
            <Button onClick={() => { setSelected(new Set([preview.key])); rememberPrinted(1); setTimeout(() => window.print(), 100); }}><Printer className="w-4 h-4 mr-1.5" />In nhãn này</Button>
          </div>
        </>}
      </div>
    </div>

    <div id="qr-print-root">{selectedItems.map((item) => <PrintableLabel key={item.key} item={item} preset={preset} />)}</div>
    <div ref={pdfRootRef} id="qr-pdf-root" aria-hidden="true">{selectedItems.map((item) => <PrintableLabel key={item.key} item={item} preset={preset.a4 ? LABEL_PRESETS.a4 : preset} pdfKey={item.key} />)}</div>

    <style>{`
      #qr-print-root { display:none; }
      #qr-pdf-root { position: fixed; left: -12000px; top: 0; display: grid; gap: 8px; background: white; padding: 8px; z-index:-1; }
      @media print {
        @page { size: A4 portrait; margin: 8mm; }
        body * { visibility: hidden !important; }
        #qr-print-root, #qr-print-root * { visibility: visible !important; }
        #qr-print-root { display:grid !important; position:absolute; left:0; top:0; width:100%; grid-template-columns:${preset.a4 ? 'repeat(2, 90mm)' : 'repeat(auto-fit, minmax(' + preset.widthMm + 'mm, ' + preset.widthMm + 'mm))'}; gap:4mm; align-items:start; }
        #qr-print-root .print-label { break-inside: avoid; page-break-inside: avoid; }
      }
    `}</style>
  </div>;
}
