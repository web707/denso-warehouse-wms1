import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Zap, Lock } from 'lucide-react';
import { api } from '@/api';
import { fmtNum } from '@/lib/calculations';
import {
  KEYS, WO_STATUS, WO_TYPES, fmtDate, inputToIso, isWorkOrderOverdue, isoToDateInput, isoToDateTimeInput,
  numOrNull, strOrNull, useWorkOrders, workOrderProgress,
} from '@/lib/supplyChain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import Pill from '@/components/Pill';
import RecordDialog from '@/components/RecordDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = Object.entries(WO_STATUS).map(([value, m]) => ({ value, label: m.label }));

const FIELDS = [
  { type: 'section', label: 'Lệnh sản xuất' },
  { key: 'workOrderNumber', label: 'Số lệnh (WorkOrderNumber)', required: true, placeholder: 'WO-2026-0001' },
  { key: 'workOrderType', label: 'Loại lệnh (WorkOrderType)', type: 'select', options: WO_TYPES },
  { key: 'workOrderStatus', label: 'Trạng thái (WorkOrderStatus)', type: 'select', options: STATUS_OPTIONS },
  { key: 'itemNumber', label: 'Item Number', required: true, placeholder: 'A009', help: 'Mã linh kiện được sản xuất' },
  { key: 'lotNumber', label: 'Lot Number', placeholder: 'LOT-2026-001', help: 'Liên kết với kho và kiểm tra chất lượng' },
  { key: 'organizationCode', label: 'Nhà máy (OrganizationCode)' },
  { type: 'section', label: 'Số lượng' },
  { key: 'plannedStartQuantity', label: 'Kế hoạch (PlannedStartQuantity)', type: 'number', required: true },
  { key: 'completedQuantity', label: 'Hoàn thành (CompletedQuantity)', type: 'number' },
  { key: 'scrappedQuantity', label: 'Phế phẩm (ScrappedQuantity)', type: 'number' },
  { key: 'inProcessQuantity', label: 'Đang gia công (InProcessQuantity)', type: 'number' },
  { type: 'section', label: 'Thời gian' },
  { key: 'plannedStartDate', label: 'Bắt đầu kế hoạch', type: 'datetime-local' },
  { key: 'plannedCompletionDate', label: 'Hoàn thành kế hoạch', type: 'datetime-local' },
  { key: 'dueDate', label: 'Hạn giao (DueDate)', type: 'date' },
  { key: 'actualStartDate', label: 'Bắt đầu thực tế', type: 'datetime-local', help: 'Tự điền khi phát hành' },
  { key: 'actualCompletionDate', label: 'Hoàn thành thực tế', type: 'datetime-local', help: 'Tự điền khi hoàn thành' },
  { type: 'section', label: 'Xưởng và công đoạn' },
  { key: 'workCenterCode', label: 'Mã xưởng (WorkCenterCode)' },
  { key: 'workCenterName', label: 'Tên xưởng (WorkCenterName)' },
  { key: 'resourceCode', label: 'Máy / nhân công (ResourceCode)' },
  { key: 'workDefinitionCode', label: 'Quy trình (WorkDefinitionCode)' },
  { key: 'operationSequenceNumber', label: 'Công đoạn số', type: 'number', step: 1 },
  { key: 'operationStatus', label: 'Trạng thái công đoạn' },
  { type: 'section', label: 'Khách hàng' },
  { key: 'customerNumber', label: 'Mã khách (CustomerNumber)' },
  { key: 'customerName', label: 'Tên khách (CustomerName)', placeholder: 'Toyota' },
  { key: 'demandSourceHeaderNumber', label: 'Đơn hàng nguồn' },
  { key: 'firmPlannedFlag', label: 'Đã khóa kế hoạch (Firm)', type: 'switch' },
  { key: 'expeditedFlag', label: 'Đơn gấp (Expedited)', type: 'switch' },
];

const EMPTY = {
  workOrderNumber: '', workOrderType: 'STANDARD', workOrderStatus: 'UNRELEASED', itemNumber: '', lotNumber: '',
  organizationCode: 'DENSO-WH', plannedStartQuantity: '', completedQuantity: '0', scrappedQuantity: '0', inProcessQuantity: '0',
  plannedStartDate: '', plannedCompletionDate: '', dueDate: '', actualStartDate: '', actualCompletionDate: '',
  workCenterCode: '', workCenterName: '', resourceCode: '', workDefinitionCode: '', operationSequenceNumber: '', operationStatus: '',
  customerNumber: '', customerName: '', demandSourceHeaderNumber: '', firmPlannedFlag: false, expeditedFlag: false,
};

function toForm(wo) {
  if (!wo) return EMPTY;
  const f = { ...EMPTY };
  Object.keys(EMPTY).forEach((k) => { if (wo[k] !== null && wo[k] !== undefined) f[k] = wo[k]; });
  ['plannedStartDate', 'plannedCompletionDate', 'actualStartDate', 'actualCompletionDate'].forEach((k) => { f[k] = isoToDateTimeInput(wo[k]); });
  f.dueDate = isoToDateInput(wo.dueDate);
  ['plannedStartQuantity', 'completedQuantity', 'scrappedQuantity', 'inProcessQuantity', 'operationSequenceNumber'].forEach((k) => { f[k] = String(wo[k] ?? ''); });
  return f;
}

function toBody(v) {
  return {
    workOrderNumber: v.workOrderNumber.trim(),
    workOrderType: v.workOrderType,
    workOrderStatus: v.workOrderStatus,
    itemNumber: v.itemNumber.trim(),
    organizationCode: strOrNull(v.organizationCode) || 'DENSO-WH',
    lotNumber: strOrNull(v.lotNumber),
    plannedStartQuantity: numOrNull(v.plannedStartQuantity) ?? 0,
    completedQuantity: numOrNull(v.completedQuantity) ?? 0,
    scrappedQuantity: numOrNull(v.scrappedQuantity) ?? 0,
    inProcessQuantity: numOrNull(v.inProcessQuantity) ?? 0,
    plannedStartDate: inputToIso(v.plannedStartDate),
    plannedCompletionDate: inputToIso(v.plannedCompletionDate),
    actualStartDate: inputToIso(v.actualStartDate),
    actualCompletionDate: inputToIso(v.actualCompletionDate),
    dueDate: inputToIso(v.dueDate),
    workCenterCode: strOrNull(v.workCenterCode),
    workCenterName: strOrNull(v.workCenterName),
    resourceCode: strOrNull(v.resourceCode),
    workDefinitionCode: strOrNull(v.workDefinitionCode),
    operationSequenceNumber: numOrNull(v.operationSequenceNumber),
    operationStatus: strOrNull(v.operationStatus),
    customerNumber: strOrNull(v.customerNumber),
    customerName: strOrNull(v.customerName),
    demandSourceHeaderNumber: strOrNull(v.demandSourceHeaderNumber),
    firmPlannedFlag: !!v.firmPlannedFlag,
    expeditedFlag: !!v.expeditedFlag,
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

export default function WorkOrders() {
  const { data: rows = [], isLoading, isError, refetch } = useWorkOrders();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.workOrderStatus === 'RELEASED');
    return {
      total: rows.length,
      running: active.length,
      overdue: rows.filter((r) => isWorkOrderOverdue(r)).length,
      expedited: rows.filter((r) => r.expeditedFlag && !['COMPLETED', 'CANCELLED'].includes(r.workOrderStatus)).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (status === 'ALL' || r.workOrderStatus === status)
      && (!q || `${r.workOrderNumber} ${r.itemNumber} ${r.lotNumber || ''} ${r.customerName || ''}`.toLowerCase().includes(q)));
  }, [rows, status, search]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (wo) => { setEditing(wo); setDialogOpen(true); };
  const initial = useMemo(() => toForm(editing), [editing]);

  const save = async (values) => {
    const body = toBody(values);
    if (editing) await api.workOrders.update(editing.id, body);
    else await api.workOrders.create(body);
    await qc.invalidateQueries({ queryKey: KEYS.workOrders });
    toast({ title: editing ? 'Đã cập nhật lệnh sản xuất' : 'Đã tạo lệnh sản xuất', description: body.workOrderNumber });
  };

  const remove = async () => {
    try {
      await api.workOrders.remove(toDelete.id);
      await qc.invalidateQueries({ queryKey: KEYS.workOrders });
      toast({ title: 'Đã xóa lệnh sản xuất', description: toDelete.workOrderNumber });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không xóa được', description: e.message });
    }
    setToDelete(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kế hoạch sản xuất</h1>
          <p className="text-sm text-slate-500 mt-1">Lệnh sản xuất (Work Order) · Khâu 1 · Oracle Fusion Manufacturing</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Thêm lệnh</Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white grid grid-cols-2 lg:grid-cols-4 overflow-hidden [&>*]:border-slate-200 [&>*:nth-child(2n)]:border-l lg:[&>*]:border-l [&>*:first-child]:border-l-0 [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0">
        <Kpi label="Tổng lệnh" value={fmtNum(stats.total)} />
        <Kpi label="Đang sản xuất" value={fmtNum(stats.running)} />
        <Kpi label="Trễ hạn" value={fmtNum(stats.overdue)} tone={stats.overdue ? 'bad' : undefined} sub={stats.overdue ? 'Quá hạn giao, chưa hoàn thành' : 'Không có lệnh trễ'} />
        <Kpi label="Đơn gấp đang chạy" value={fmtNum(stats.expedited)} tone={stats.expedited ? 'warn' : undefined} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm số lệnh, Item, Lot, khách hàng…" aria-label="Tìm lệnh sản xuất" className="pl-9" />
        </div>
        <select aria-label="Lọc theo trạng thái" value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 border border-input rounded-md px-3 bg-white text-sm">
          <option value="ALL">Tất cả trạng thái</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {['Lệnh sản xuất', 'Item / Lot', 'Tiến độ', 'Trạng thái', 'Xưởng', 'Khách hàng', 'Hạn giao', ''].map((h) => (
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
                  {rows.length === 0 ? 'Chưa có lệnh sản xuất nào. Bấm "Thêm lệnh" để tạo lệnh đầu tiên.' : 'Không có lệnh nào khớp bộ lọc.'}
                </td></tr>
              )}
              {filtered.map((wo) => {
                const prog = workOrderProgress(wo);
                const meta = WO_STATUS[wo.workOrderStatus] || WO_STATUS.UNRELEASED;
                const overdue = isWorkOrderOverdue(wo);
                return (
                  <tr key={wo.id} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{wo.workOrderNumber}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Pill>{wo.workOrderType}</Pill>
                        {wo.expeditedFlag && <Pill tone="amber"><Zap className="w-3 h-3" />Gấp</Pill>}
                        {wo.firmPlannedFlag && <Pill tone="indigo"><Lock className="w-3 h-3" />Đã khóa</Pill>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-slate-800">{wo.itemNumber}</p>
                      {wo.lotNumber
                        ? <Link to={`/trace?lot=${encodeURIComponent(wo.lotNumber)}`} className="text-xs text-indigo-600 hover:underline">{wo.lotNumber}</Link>
                        : <span className="text-xs text-slate-400">Chưa có lô</span>}
                    </td>
                    <td className="px-3 py-3 min-w-[170px]">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog.donePct)} aria-label="Tiến độ hoàn thành">
                        <div className="h-full bg-emerald-500" style={{ width: `${prog.donePct}%` }} />
                        <div className="h-full bg-red-400" style={{ width: `${prog.scrapPct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 tabular-nums">
                        {fmtNum(wo.completedQuantity)} / {fmtNum(wo.plannedStartQuantity)}
                        {wo.scrappedQuantity > 0 && <span className="text-red-600"> · phế {fmtNum(wo.scrappedQuantity)}</span>}
                      </p>
                    </td>
                    <td className="px-3 py-3"><Pill tone={meta.tone}>{meta.label}</Pill></td>
                    <td className="px-3 py-3 text-slate-600">
                      {wo.workCenterName || wo.workCenterCode || '—'}
                      {wo.operationSequenceNumber != null && <p className="text-xs text-slate-400">Công đoạn {wo.operationSequenceNumber}</p>}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {wo.customerName || '—'}
                      {wo.demandSourceHeaderNumber && <p className="text-xs text-slate-400">{wo.demandSourceHeaderNumber}</p>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="tabular-nums">{fmtDate(wo.dueDate)}</span>
                      {overdue && <div className="mt-1"><Pill tone="red">Trễ hạn</Pill></div>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon" aria-label={`Sửa ${wo.workOrderNumber}`} onClick={() => openEdit(wo)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Xóa ${wo.workOrderNumber}`} onClick={() => setToDelete(wo)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
        title={editing ? `Sửa lệnh ${editing.workOrderNumber}` : 'Thêm lệnh sản xuất'}
        description="Hoàn thành + phế phẩm không được vượt quá số lượng kế hoạch."
        fields={FIELDS}
        initial={initial}
        onSubmit={save}
        submitLabel={editing ? 'Lưu thay đổi' : 'Tạo lệnh'}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Xóa lệnh sản xuất?"
        description={toDelete ? `Lệnh ${toDelete.workOrderNumber} sẽ bị xóa vĩnh viễn.` : ''}
        onConfirm={remove}
      />
    </div>
  );
}
