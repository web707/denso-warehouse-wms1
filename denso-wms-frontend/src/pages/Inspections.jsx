import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '@/api';
import { fmtDec, fmtNum } from '@/lib/calculations';
import {
  INSPECTION_TYPES, JUDGMENT, KEYS, fmtDate, inputToIso, isoToDateTimeInput, numOrNull, outOfTolerance, strOrNull, useInspections,
} from '@/lib/supplyChain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import Pill from '@/components/Pill';
import RecordDialog from '@/components/RecordDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

const JUDGMENT_OPTIONS = [
  { value: 'AUTO', label: 'Tự động theo kết quả' },
  { value: 'OK', label: 'OK — đạt' },
  { value: 'NG', label: 'NG — không đạt' },
  { value: 'HOLD', label: 'HOLD — giữ lại chờ xử lý' },
];

const FIELDS = [
  { type: 'section', label: 'Phiếu kiểm tra' },
  { key: 'inspectionId', label: 'Mã phiếu (InspectionId)', placeholder: 'Để trống để tự sinh' },
  { key: 'lotNumber', label: 'Lot Number', required: true, placeholder: 'LOT-2026-001' },
  { key: 'workOrderNumber', label: 'Lệnh sản xuất (WorkOrderNumber)', placeholder: 'WO-2026-0001' },
  { key: 'inspectionType', label: 'Loại kiểm tra', type: 'select', options: INSPECTION_TYPES },
  { key: 'inspectionDate', label: 'Thời gian kiểm tra', type: 'datetime-local' },
  { key: 'inspectorId', label: 'Người kiểm tra (InspectorId)' },
  { type: 'section', label: 'Kết quả mẫu' },
  { key: 'sampleSize', label: 'Cỡ mẫu (SampleSize)', type: 'number', step: 1, required: true },
  { key: 'passQuantity', label: 'Số đạt (PassQuantity)', type: 'number', step: 1, required: true },
  { key: 'failQuantity', label: 'Số lỗi (FailQuantity)', type: 'number', step: 1, required: true },
  { key: 'defectCode', label: 'Mã lỗi (DefectCode)', placeholder: 'D-101', help: 'Theo phân loại lỗi IATF 16949' },
  { type: 'section', label: 'Đo kích thước (CMM)' },
  { key: 'measuredValue1', label: 'Giá trị đo (MeasuredValue_1)', type: 'number', min: -1e9 },
  { key: 'upperTolerance', label: 'Dung sai trên', type: 'number', min: -1e9 },
  { key: 'lowerTolerance', label: 'Dung sai dưới', type: 'number', min: -1e9 },
  { type: 'section', label: 'Kết luận' },
  { key: 'judgment', label: 'Kết luận (Judgment)', type: 'select', options: JUDGMENT_OPTIONS, span: 2 },
];

const EMPTY = {
  inspectionId: '', lotNumber: '', workOrderNumber: '', inspectionType: 'INCOMING', inspectionDate: '', inspectorId: '',
  sampleSize: '', passQuantity: '', failQuantity: '0', defectCode: '', measuredValue1: '', upperTolerance: '', lowerTolerance: '',
  judgment: 'AUTO',
};

function toForm(r) {
  if (!r) return EMPTY;
  const f = { ...EMPTY };
  Object.keys(EMPTY).forEach((k) => { if (r[k] !== null && r[k] !== undefined) f[k] = r[k]; });
  f.inspectionDate = isoToDateTimeInput(r.inspectionDate);
  ['sampleSize', 'passQuantity', 'failQuantity', 'measuredValue1', 'upperTolerance', 'lowerTolerance'].forEach((k) => { f[k] = String(r[k] ?? ''); });
  return f;
}

/** Kết luận thực tế sẽ lưu: nếu chọn Tự động thì NG khi có lỗi hoặc đo ngoài dung sai (khớp backend). */
function resolveJudgment(v) {
  if (v.judgment !== 'AUTO') return v.judgment;
  return Number(v.failQuantity) > 0 || outOfTolerance(v) ? 'NG' : 'OK';
}

function toBody(v) {
  return {
    ...(strOrNull(v.inspectionId) ? { inspectionId: v.inspectionId.trim() } : {}),
    lotNumber: v.lotNumber.trim(),
    workOrderNumber: strOrNull(v.workOrderNumber),
    inspectionType: v.inspectionType,
    ...(v.inspectionDate ? { inspectionDate: inputToIso(v.inspectionDate) } : {}),
    inspectorId: strOrNull(v.inspectorId),
    sampleSize: Math.round(Number(v.sampleSize) || 0),
    passQuantity: Math.round(Number(v.passQuantity) || 0),
    failQuantity: Math.round(Number(v.failQuantity) || 0),
    defectCode: strOrNull(v.defectCode),
    measuredValue1: numOrNull(v.measuredValue1),
    upperTolerance: numOrNull(v.upperTolerance),
    lowerTolerance: numOrNull(v.lowerTolerance),
    judgment: resolveJudgment(v),
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

function JudgmentHint({ values }) {
  const j = resolveJudgment(values);
  const reasons = [];
  if (Number(values.failQuantity) > 0) reasons.push('có sản phẩm lỗi');
  if (outOfTolerance(values)) reasons.push('giá trị đo nằm ngoài dung sai');
  if (values.judgment === 'OK' && reasons.length) {
    return <p role="status" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Không thể kết luận OK vì {reasons.join(' và ')}. Hãy chọn NG hoặc HOLD.</p>;
  }
  if (values.judgment === 'AUTO') {
    return (
      <p role="status" className="text-sm text-slate-600">
        Kết luận sẽ lưu: <Pill tone={JUDGMENT[j].tone}>{j}</Pill>{reasons.length ? ` (${reasons.join(', ')})` : ''}
      </p>
    );
  }
  return null;
}

export default function Inspections() {
  const { data: rows = [], isLoading, isError, refetch } = useInspections();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [judgment, setJudgment] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const stats = useMemo(() => {
    const sample = rows.reduce((s, r) => s + r.sampleSize, 0);
    const pass = rows.reduce((s, r) => s + r.passQuantity, 0);
    return {
      total: rows.length,
      passRate: sample > 0 ? (pass / sample) * 100 : null,
      ng: rows.filter((r) => r.judgment === 'NG').length,
      hold: rows.filter((r) => r.judgment === 'HOLD').length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (judgment === 'ALL' || r.judgment === judgment)
      && (type === 'ALL' || r.inspectionType === type)
      && (!q || `${r.inspectionId} ${r.lotNumber} ${r.workOrderNumber || ''} ${r.defectCode || ''} ${r.inspectorId || ''}`.toLowerCase().includes(q)));
  }, [rows, judgment, type, search]);

  const initial = useMemo(() => toForm(editing), [editing]);

  const save = async (values) => {
    const body = toBody(values);
    if (editing) await api.inspections.update(editing.id, body);
    else await api.inspections.create(body);
    await qc.invalidateQueries({ queryKey: KEYS.inspections });
    toast({ title: editing ? 'Đã cập nhật phiếu kiểm tra' : 'Đã lưu phiếu kiểm tra', description: `${body.lotNumber} · ${body.judgment}` });
  };

  const remove = async () => {
    try {
      await api.inspections.remove(toDelete.id);
      await qc.invalidateQueries({ queryKey: KEYS.inspections });
      toast({ title: 'Đã xóa phiếu kiểm tra', description: toDelete.inspectionId });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Không xóa được', description: e.message });
    }
    setToDelete(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kiểm tra chất lượng</h1>
          <p className="text-sm text-slate-500 mt-1">Phiếu kiểm tra theo lô · Khâu 4 · chuẩn IATF 16949</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />Thêm phiếu</Button>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
        Lưu ý: cấu trúc dữ liệu Khâu 4 là dữ liệu giả lập (DENSO và Oracle chưa công bố định dạng chính thức).
      </p>

      <div className="rounded-xl border border-slate-200 bg-white grid grid-cols-2 lg:grid-cols-4 overflow-hidden [&>*]:border-slate-200 [&>*:nth-child(2n)]:border-l lg:[&>*]:border-l [&>*:first-child]:border-l-0 [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0">
        <Kpi label="Tổng phiếu" value={fmtNum(stats.total)} />
        <Kpi label="Tỷ lệ đạt (theo mẫu)" value={stats.passRate === null ? '—' : `${fmtDec(stats.passRate, 1)}%`} />
        <Kpi label="Phiếu NG" value={fmtNum(stats.ng)} tone={stats.ng ? 'bad' : undefined} />
        <Kpi label="Phiếu HOLD" value={fmtNum(stats.hold)} tone={stats.hold ? 'warn' : undefined} sub={stats.hold ? 'Hàng đang bị giữ chờ xử lý' : undefined} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã phiếu, Lot, lệnh sản xuất, mã lỗi…" aria-label="Tìm phiếu kiểm tra" className="pl-9" />
        </div>
        <select aria-label="Lọc theo kết luận" value={judgment} onChange={(e) => setJudgment(e.target.value)} className="h-10 border border-input rounded-md px-3 bg-white text-sm">
          <option value="ALL">Mọi kết luận</option>
          <option value="OK">OK</option><option value="NG">NG</option><option value="HOLD">HOLD</option>
        </select>
        <select aria-label="Lọc theo loại kiểm tra" value={type} onChange={(e) => setType(e.target.value)} className="h-10 border border-input rounded-md px-3 bg-white text-sm">
          <option value="ALL">Mọi loại</option>
          {INSPECTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
        </select>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {['Phiếu', 'Lô / Lệnh SX', 'Loại', 'Kết quả mẫu', 'Kết luận', 'Mã lỗi', 'Đo CMM', 'Người KT', ''].map((h) => (
                  <th key={h} scope="col" className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-t border-slate-200"><td colSpan={9} className="px-3 py-3"><Skeleton className="h-6 w-full" /></td></tr>
              ))}
              {isError && (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                  Không tải được dữ liệu. <button type="button" className="text-indigo-600 underline" onClick={() => refetch()}>Thử lại</button>
                </td></tr>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-slate-500">
                  {rows.length === 0 ? 'Chưa có phiếu kiểm tra nào. Bấm "Thêm phiếu" để ghi kết quả kiểm tra đầu tiên.' : 'Không có phiếu nào khớp bộ lọc.'}
                </td></tr>
              )}
              {filtered.map((r) => {
                const meta = JUDGMENT[r.judgment] || JUDGMENT.OK;
                const out = outOfTolerance(r);
                const failPct = r.sampleSize > 0 ? (r.failQuantity / r.sampleSize) * 100 : 0;
                return (
                  <tr key={r.id} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900 whitespace-nowrap">{r.inspectionId}</p>
                      <p className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.inspectionDate, true)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Link to={`/trace?lot=${encodeURIComponent(r.lotNumber)}`} className="text-indigo-600 hover:underline">{r.lotNumber}</Link>
                      {r.workOrderNumber && <p className="text-xs text-slate-500">{r.workOrderNumber}</p>}
                    </td>
                    <td className="px-3 py-3"><Pill>{r.inspectionType}</Pill></td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      <span className="text-emerald-600">{fmtNum(r.passQuantity)} đạt</span>
                      {' · '}
                      <span className={r.failQuantity > 0 ? 'text-red-600' : 'text-slate-500'}>{fmtNum(r.failQuantity)} lỗi</span>
                      <p className="text-xs text-slate-500">/ {fmtNum(r.sampleSize)} mẫu{r.failQuantity > 0 ? ` · ${fmtDec(failPct, 1)}% lỗi` : ''}</p>
                    </td>
                    <td className="px-3 py-3"><Pill tone={meta.tone}>{meta.label}</Pill></td>
                    <td className="px-3 py-3 text-slate-600">{r.defectCode || '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                      {r.measuredValue1 === null ? '—' : (
                        <>
                          <span className={out ? 'text-red-600 font-semibold' : ''}>{r.measuredValue1}</span>
                          {(r.lowerTolerance !== null || r.upperTolerance !== null) && (
                            <p className="text-xs text-slate-500">{r.lowerTolerance ?? '−∞'} … {r.upperTolerance ?? '+∞'}</p>
                          )}
                          {out && <Pill tone="red" className="mt-1">Ngoài dung sai</Pill>}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{r.inspectorId || '—'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon" aria-label={`Sửa ${r.inspectionId}`} onClick={() => { setEditing(r); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Xóa ${r.inspectionId}`} onClick={() => setToDelete(r)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
        title={editing ? `Sửa phiếu ${editing.inspectionId}` : 'Thêm phiếu kiểm tra'}
        description="Số đạt + số lỗi không được vượt quá cỡ mẫu. Kết luận OK chỉ hợp lệ khi không có lỗi và giá trị đo nằm trong dung sai."
        fields={FIELDS}
        initial={initial}
        onSubmit={save}
        submitLabel={editing ? 'Lưu thay đổi' : 'Lưu phiếu'}
        footerNote={(values) => <JudgmentHint values={values} />}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Xóa phiếu kiểm tra?"
        description={toDelete ? `Phiếu ${toDelete.inspectionId} sẽ bị xóa vĩnh viễn và có thể làm đổi trạng thái chất lượng của lô ${toDelete.lotNumber}.` : ''}
        onConfirm={remove}
      />
    </div>
  );
}
