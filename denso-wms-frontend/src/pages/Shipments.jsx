import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Truck, PackageCheck, Download, FileJson, FileText, Upload } from 'lucide-react';
import { api } from '@/api';
import { fmtNum } from '@/lib/calculations';
import {
  KEYS, SHIPMENT_STATUS, fmtDate, inputToIso, isShipmentLate, isoToDateInput, numOrNull, strOrNull, useShipments,
} from '@/lib/supplyChain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { filenameFrom, saveFile } from '@/lib/download';
import OracleImportDialog from '@/components/OracleImportDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import Pill from '@/components/Pill';
import RecordDialog from '@/components/RecordDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = Object.entries(SHIPMENT_STATUS).map(([value, m]) => ({ value, label: `${value} — ${m.label}` }));

const FIELDS = [
  { type: 'section', label: 'Lô giao hàng' },
  { key: 'shipmentNumber', label: 'Mã lô giao (ShipmentNumber)', required: true, placeholder: 'SHP-2026-0001' },
  { key: 'shipmentStatus', label: 'Trạng thái (ShipmentStatus)', type: 'select', options: STATUS_OPTIONS },
  { key: 'sourceOrderNumber', label: 'Đơn hàng của khách (SourceOrderNumber)' },
  { type: 'section', label: 'Khách hàng' },
  { key: 'customerName', label: 'Tên khách (CustomerName)', required: true, placeholder: 'Toyota' },
  { key: 'customerNumber', label: 'Mã khách (CustomerNumber)' },
  { type: 'section', label: 'Hàng giao' },
  { key: 'itemNumber', label: 'Item Number', required: true, placeholder: 'A009' },
  { key: 'lotNumber', label: 'Lot Number', placeholder: 'LOT-2026-001', help: 'Dùng để truy vết ngược về kho và kiểm tra' },
  { key: 'shippedQuantity', label: 'Số lượng (ShippedQuantity)', type: 'number' },
  { key: 'grossWeight', label: 'Tổng trọng lượng (GrossWeight)', type: 'number' },
  { key: 'weightUomCode', label: 'Đơn vị cân (WeightUOMCode)' },
  { type: 'section', label: 'Vận chuyển' },
  { key: 'carrierCode', label: 'Hãng vận chuyển (CarrierCode)' },
  { key: 'trackingNumber', label: 'Mã vận đơn (TrackingNumber)' },
  { key: 'requestedShipDate', label: 'Ngày yêu cầu giao', type: 'date' },
  { key: 'actualShipDate', label: 'Ngày giao thực tế', type: 'date', help: 'Tự điền khi chuyển sang SHIPPED/DELIVERED' },
];

const EMPTY = {
  shipmentNumber: '', shipmentStatus: 'RELEASED', sourceOrderNumber: '', customerName: '', customerNumber: '', itemNumber: '', lotNumber: '',
  shippedQuantity: '', grossWeight: '', weightUomCode: 'KG', carrierCode: '', trackingNumber: '', requestedShipDate: '', actualShipDate: '',
};

function toForm(s) {
  if (!s) return EMPTY;
  const f = { ...EMPTY };
  Object.keys(EMPTY).forEach((k) => { if (s[k] !== null && s[k] !== undefined) f[k] = s[k]; });
  f.requestedShipDate = isoToDateInput(s.requestedShipDate);
  f.actualShipDate = isoToDateInput(s.actualShipDate);
  f.shippedQuantity = String(s.shippedQuantity ?? '');
  f.grossWeight = String(s.grossWeight ?? '');
  return f;
}

function toBody(v) {
  return {
    shipmentNumber: v.shipmentNumber.trim(),
    shipmentStatus: v.shipmentStatus,
    sourceOrderNumber: strOrNull(v.sourceOrderNumber),
    customerName: v.customerName.trim(),
    customerNumber: strOrNull(v.customerNumber),
    itemNumber: v.itemNumber.trim(),
    lotNumber: strOrNull(v.lotNumber),
    shippedQuantity: numOrNull(v.shippedQuantity) ?? 0,
    grossWeight: numOrNull(v.grossWeight),
    weightUomCode: strOrNull(v.weightUomCode) || 'KG',
    carrierCode: strOrNull(v.carrierCode),
    trackingNumber: strOrNull(v.trackingNumber),
    requestedShipDate: inputToIso(v.requestedShipDate),
    actualShipDate: inputToIso(v.actualShipDate),
  };
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-semibold tabular-nums text-slate-900', tone === 'warn' && 'text-amber-600', tone === 'bad' && 'text-red-600')}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function Shipments() {
  const { data: rows = [], isLoading, isError, refetch } = useShipments();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [oracleOpen, setOracleOpen] = useState(false);

  const stats = useMemo(() => ({
    waiting: rows.filter((r) => r.shipmentStatus === 'RELEASED').length,
    transit: rows.filter((r) => r.shipmentStatus === 'SHIPPED').length,
    delivered: rows.filter((r) => r.shipmentStatus === 'DELIVERED').length,
    late: rows.filter(isShipmentLate).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (status === 'ALL' || r.shipmentStatus === status)
      && (!q || `${r.shipmentNumber} ${r.customerName} ${r.itemNumber} ${r.lotNumber || ''} ${r.trackingNumber || ''} ${r.sourceOrderNumber || ''}`.toLowerCase().includes(q)));
  }, [rows, status, search]);

  const initial = useMemo(() => toForm(editing), [editing]);
  const refresh = () => qc.invalidateQueries({ queryKey: KEYS.shipments });

  const save = async (values) => {
    const body = toBody(values);
    if (editing) await api.shipments.update(editing.id, body);
    else await api.shipments.create(body);
    await refresh();
    toast({ title: editing ? 'Đã cập nhật lô giao' : 'Đã tạo lô giao', description: body.shipmentNumber });
  };

  const advance = async (s, next) => {
    try {
      await api.shipments.update(s.id, { shipmentStatus: next });
      await refresh();
      toast({ title: next === 'SHIPPED' ? 'Đã xuất phát' : 'Đã giao thành công', description: s.shipmentNumber });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không cập nhật được', description: e.message });
    }
  };

  const exportJson = async (one) => {
    try {
      const data = one ? await api.shipments.oracleOne(one.id) : await api.shipments.oracleList();
      saveFile(JSON.stringify(data, null, 2), one ? `${one.shipmentNumber}.json` : 'shipments-oracle.json', 'application/json');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không xuất được JSON', description: e.message });
    }
  };

  const exportEdi = async (s, standard) => {
    try {
      const res = await api.shipments.ediText(s.id, standard);
      saveFile(await res.text(), filenameFrom(res, `${s.shipmentNumber}.${standard === 'edifact' ? 'edi' : 'x12'}`));
      toast({ title: 'Đã tạo file EDI', description: `${s.shipmentNumber} · ${standard === 'edifact' ? 'EDIFACT DESADV D.96A' : 'X12 856 ASN'} · cờ thử nghiệm` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không tạo được file EDI', description: e.message });
    }
  };

  const remove = async () => {
    try {
      await api.shipments.remove(toDelete.id);
      await refresh();
      toast({ title: 'Đã xóa lô giao', description: toDelete.shipmentNumber });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không xóa được', description: e.message });
    }
    setToDelete(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Giao hàng</h1>
          <p className="text-sm text-slate-500 mt-1">Lô giao cho khách (Shipment) · Khâu 5 · Oracle Fusion Shipping</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOracleOpen(true)}><Upload className="w-4 h-4 mr-2" />Nhập JSON Oracle</Button>
          <Button variant="outline" onClick={() => exportJson(null)}><Download className="w-4 h-4 mr-2" />Xuất JSON Oracle</Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Thêm lô giao</Button>
        </div>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
        Lưu ý: định dạng Khâu 5 (JSON + EDI) đã được xác nhận, các trường chi tiết là dữ liệu giả lập bám theo chuẩn ngành. File EDI xuất ra mang cờ thử nghiệm và cần đối chiếu Implementation Guide của Toyota/Honda trước khi gửi thật.
      </p>

      <div className="rounded-xl border border-slate-200 bg-white grid grid-cols-2 lg:grid-cols-4 overflow-hidden [&>*]:border-slate-200 [&>*:nth-child(2n)]:border-l lg:[&>*]:border-l [&>*:first-child]:border-l-0 [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0">
        <Kpi label="Chờ giao" value={fmtNum(stats.waiting)} />
        <Kpi label="Đang vận chuyển" value={fmtNum(stats.transit)} />
        <Kpi label="Đã giao" value={fmtNum(stats.delivered)} />
        <Kpi label="Đang trễ" value={fmtNum(stats.late)} tone={stats.late ? 'bad' : undefined} sub={stats.late ? 'Chờ giao nhưng đã quá ngày yêu cầu' : 'Không có lô trễ'} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã lô giao, khách hàng, Item, Lot, vận đơn…" aria-label="Tìm lô giao hàng" className="pl-9" />
        </div>
        <select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 border border-input rounded-md px-3 bg-white text-sm">
          <option value="ALL">Tất cả trạng thái</option>
          {Object.entries(SHIPMENT_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {['Lô giao', 'Khách hàng', 'Item / Lot', 'Số lượng', 'Vận chuyển', 'Ngày giao', 'Trạng thái', ''].map((h) => (
                  <th key={h} scope="col" className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-t border-slate-200"><td colSpan={8} className="px-3 py-3"><Skeleton className="h-6 w-full" /></td></tr>
              ))}
              {isError && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  Không tải được dữ liệu. <button type="button" className="text-indigo-600 underline" onClick={() => refetch()}>Thử lại</button>
                </td></tr>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-500">
                  {rows.length === 0 ? 'Chưa có lô giao nào. Bấm "Thêm lô giao" để tạo lô đầu tiên.' : 'Không có lô nào khớp bộ lọc.'}
                </td></tr>
              )}
              {filtered.map((s) => {
                const meta = SHIPMENT_STATUS[s.shipmentStatus] || SHIPMENT_STATUS.RELEASED;
                return (
                  <tr key={s.id} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900 whitespace-nowrap">{s.shipmentNumber}</p>
                      <p className="text-xs text-slate-400">ID {s.shipmentId}</p>
                      {s.sourceOrderNumber && <p className="text-xs text-slate-500">Đơn: {s.sourceOrderNumber}</p>}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{s.customerName}{s.customerNumber && <p className="text-xs text-slate-400">{s.customerNumber}</p>}</td>
                    <td className="px-3 py-3">
                      <p className="text-slate-800">{s.itemNumber}</p>
                      {s.lotNumber
                        ? <Link to={`/trace?lot=${encodeURIComponent(s.lotNumber)}`} className="text-xs text-indigo-600 hover:underline">{s.lotNumber}</Link>
                        : <span className="text-xs text-slate-400">Chưa có lô</span>}
                    </td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      {fmtNum(s.shippedQuantity)}
                      {s.grossWeight !== null && <p className="text-xs text-slate-500">{fmtNum(s.grossWeight)} {s.weightUomCode}</p>}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{s.carrierCode || '—'}{s.trackingNumber && <p className="text-xs text-slate-400">{s.trackingNumber}</p>}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="text-xs text-slate-500">Yêu cầu: <span className="tabular-nums text-slate-700">{fmtDate(s.requestedShipDate)}</span></p>
                      <p className="text-xs text-slate-500">Thực tế: <span className="tabular-nums text-slate-700">{fmtDate(s.actualShipDate)}</span></p>
                      {s.delayDays > 0 && <Pill tone="red" className="mt-1">Trễ {s.delayDays} ngày</Pill>}
                    </td>
                    <td className="px-3 py-3"><Pill tone={meta.tone}>{meta.label}</Pill></td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      {s.shipmentStatus === 'RELEASED' && (
                        <Button variant="outline" size="sm" className="mr-1" onClick={() => advance(s, 'SHIPPED')}><Truck className="w-4 h-4 mr-1.5" />Xuất phát</Button>
                      )}
                      {s.shipmentStatus === 'SHIPPED' && (
                        <Button variant="outline" size="sm" className="mr-1" onClick={() => advance(s, 'DELIVERED')}><PackageCheck className="w-4 h-4 mr-1.5" />Đã giao</Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Xuất dữ liệu ${s.shipmentNumber}`}><Download className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Xuất {s.shipmentNumber}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => exportJson(s)}><FileJson className="w-4 h-4 mr-2" />JSON Oracle</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportEdi(s, 'x12')}><FileText className="w-4 h-4 mr-2" />EDI X12 856 (ASN)</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportEdi(s, 'edifact')}><FileText className="w-4 h-4 mr-2" />EDIFACT DESADV</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" aria-label={`Sửa ${s.shipmentNumber}`} onClick={() => { setEditing(s); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Xóa ${s.shipmentNumber}`} onClick={() => setToDelete(s)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <RecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? `Sửa lô giao ${editing.shipmentNumber}` : 'Thêm lô giao hàng'}
        description="Số ngày trễ được tính tự động từ ngày yêu cầu và ngày giao thực tế."
        fields={FIELDS}
        initial={initial}
        onSubmit={save}
        submitLabel={editing ? 'Lưu thay đổi' : 'Tạo lô giao'}
      />
      <OracleImportDialog open={oracleOpen} onOpenChange={setOracleOpen} onDone={refresh} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Xóa lô giao?"
        description={toDelete ? `Lô ${toDelete.shipmentNumber} sẽ bị xóa vĩnh viễn.` : ''}
        onConfirm={remove}
      />
    </div>
  );
}
