import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Download, Upload, Warehouse } from 'lucide-react';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const TYPES = [
  { value: 'inbound', label: 'Nhập kho', icon: Download },
  { value: 'outbound', label: 'Xuất kho', icon: Upload },
  { value: 'transfer', label: 'Điều chuyển', icon: ArrowRightLeft },
];
const slotName = (i) => i === null || i === undefined ? '—' : `S${String(i + 1).padStart(2, '0')}`;

export default function InventoryOperations() {
  const { parts, racks, resetData } = useStore();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [type, setType] = useState('inbound');
  const [partId, setPartId] = useState('');
  const [qty, setQty] = useState('0');
  const [cartons, setCartons] = useState('0');
  const [weight, setWeight] = useState('0');
  const [toRackId, setToRackId] = useState('');
  const [toSlot, setToSlot] = useState('');
  const [note, setNote] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => parts.find((p) => p.id === partId), [parts, partId]);
  const rackById = useMemo(() => Object.fromEntries(racks.map((r) => [r.id, r])), [racks]);

  const reloadTx = async () => setTransactions(await api.inventory.list({ limit: 100 }));
  useEffect(() => { reloadTx().catch(() => {}); }, []);

  const quickQuery = searchParams.toString();
  useEffect(() => {
    const mode = searchParams.get('mode');
    const quickPartId = searchParams.get('partId');
    const quickRackId = searchParams.get('rackId');
    const quickSlot = searchParams.get('slot');
    if (['inbound', 'outbound', 'transfer'].includes(mode)) setType(mode);
    if (quickPartId && parts.some((p) => p.id === quickPartId)) setPartId(quickPartId);
    if (quickRackId && racks.some((r) => r.id === quickRackId)) setToRackId(quickRackId);
    if (quickSlot !== null && quickSlot !== '' && Number.isInteger(Number(quickSlot))) setToSlot(String(Number(quickSlot)));
  }, [quickQuery, parts, racks]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTransfer = type === 'transfer';
  const located = !!selected?.rackId;
  const canPickTarget = isTransfer || (type === 'inbound' && !located);
  const where = selected ? `${rackById[selected.rackId]?.name || ''} · ${slotName(selected.preferredRackSlot)}` : '';

  const fillAll = () => {
    if (!selected) return;
    setQty(String(selected.quantity));
    setCartons(String(selected.cartons));
    setWeight(String(selected.weight));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!partId) return;
    setSaving(true);
    try {
      await api.inventory.create({
        type,
        partId,
        // Điều chuyển luôn chuyển toàn bộ PART nên không gửi số lượng đã nhập dở ở tab khác
        quantityPcs: isTransfer ? 0 : Number(qty || 0),
        cartonCount: isTransfer ? 0 : Number(cartons || 0),
        weightKg: isTransfer ? 0 : Number(weight || 0),
        // Nhập thêm vào PART đã có vị trí thì cộng tại chỗ, không gửi kệ/ô đích
        toRackId: canPickTarget ? toRackId || undefined : undefined,
        toSlot: canPickTarget && toSlot !== '' ? Number(toSlot) : undefined,
        note: note || undefined,
      });
      await Promise.all([resetData(), reloadTx()]);
      toast({ title: 'Đã ghi nhận nghiệp vụ kho', description: type === 'inbound' ? 'Nhập kho thành công' : type === 'outbound' ? 'Xuất kho thành công' : 'Điều chuyển thành công' });
      setQty('0'); setCartons('0'); setWeight('0'); setNote('');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Không thể thực hiện', description: err.message });
    } finally { setSaving(false); }
  };

  return <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Nhập · Xuất · Điều chuyển</h1>
      <p className="text-sm text-slate-500 mt-1">Nghiệp vụ tồn kho có lịch sử giao dịch riêng, giữ nguyên truy vết vị trí.</p>
    </div>

    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <form onSubmit={submit} className="bg-white border rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => <button type="button" key={t.value} onClick={() => setType(t.value)} className={`rounded-xl border px-2 py-3 text-xs font-semibold ${type === t.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}>
            <t.icon className="w-4 h-4 mx-auto mb-1" />{t.label}
          </button>)}
        </div>

        <label className="block text-sm font-medium">PART
          <select className="mt-1 w-full h-10 rounded-md border px-3 bg-white" value={partId} onChange={(e) => setPartId(e.target.value)} required>
            <option value="">Chọn linh kiện...</option>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.partName} · {p.productCode || p.masterPo}</option>)}
          </select>
        </label>

        {selected && <div className="rounded-xl bg-slate-50 border p-3 text-xs text-slate-600 grid grid-cols-2 gap-2">
          <span>Tồn: <b>{selected.quantity}</b> pcs</span><span><b>{selected.cartons}</b> thùng</span>
          <span>{selected.weight.toLocaleString('vi-VN')} kg</span><span>{rackById[selected.rackId]?.name || 'Chưa xếp'} · {slotName(selected.preferredRackSlot)}</span>
        </div>}

        {type !== 'transfer' && <div className="grid grid-cols-3 gap-2">
          <label className="text-xs">Số lượng<Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
          <label className="text-xs">Số thùng<Input type="number" min="0" value={cartons} onChange={(e) => setCartons(e.target.value)} /></label>
          <label className="text-xs">Khối lượng kg<Input type="number" min="0" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        </div>}

        {type === 'outbound' && selected && <div className="space-y-2">
          <Button type="button" variant="outline" size="sm" onClick={fillAll}>Xuất toàn bộ tồn</Button>
          <p className="text-xs text-slate-500">Số lượng và số thùng phải giảm cùng nhau. Xuất hết cả hai thì PART rời khỏi kệ.</p>
        </div>}

        {isTransfer && selected && <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          Điều chuyển sẽ chuyển <b>toàn bộ PART</b> ({selected.quantity} cái, {selected.cartons} thùng, {selected.weight.toLocaleString('vi-VN')} kg). Chuyển một phần chưa được hỗ trợ.
        </p>}

        {type === 'inbound' && located && <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          PART đang ở <b>{where}</b>. Nhập thêm sẽ cộng vào vị trí này. Muốn đổi chỗ, dùng tab Điều chuyển.
        </p>}

        {canPickTarget && <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Kệ đích
            <select className="mt-1 w-full h-10 rounded-md border px-2 bg-white" value={toRackId} onChange={(e) => setToRackId(e.target.value)}>
              <option value="">{type === 'inbound' ? 'Giữ vị trí hiện tại' : 'Chọn kệ...'}</option>
              {racks.map((r) => <option key={r.id} value={r.id}>{r.zoneCode} · {r.name}</option>)}
            </select>
          </label>
          <label className="text-xs">Ô đích
            <select className="mt-1 w-full h-10 rounded-md border px-2 bg-white" value={toSlot} onChange={(e) => setToSlot(e.target.value)}>
              <option value="">Tự chọn / chưa chỉ định</option>
              {Array.from({ length: 20 }, (_, i) => <option key={i} value={i}>{slotName(i)}</option>)}
            </select>
          </label>
        </div>}

        <label className="block text-xs">Ghi chú<Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Nhập từ chuyền A, xuất cho line 2..." /></label>
        <Button className="w-full" disabled={saving || !partId}>{saving ? 'Đang lưu...' : 'Xác nhận nghiệp vụ'}</Button>
      </form>

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex items-center gap-2"><Warehouse className="w-4 h-4"/><b>Lịch sử nghiệp vụ gần nhất</b></div>
        <div className="overflow-auto max-h-[620px]">
          <table className="w-full text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-left">Thời gian</th><th className="p-3 text-left">Loại</th><th className="p-3 text-left">PART</th><th className="p-3 text-left">Vị trí</th><th className="p-3 text-right">SL / Thùng / Kg</th></tr></thead>
          <tbody>{transactions.map((t) => <tr key={t.id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(t.createdAt).toLocaleString('vi-VN')}</td><td className="p-3 font-semibold">{t.type === 'inbound' ? 'Nhập' : t.type === 'outbound' ? 'Xuất' : 'Điều chuyển'}</td><td className="p-3">{t.partName}<div className="text-xs text-slate-400">{t.productCode}</div></td><td className="p-3 text-xs">{rackById[t.fromRackId]?.name || '—'} {slotName(t.fromSlot)} → {rackById[t.toRackId]?.name || '—'} {slotName(t.toSlot)}</td><td className="p-3 text-right">{t.quantityPcs} / {t.cartonCount} / {Number(t.weightKg).toLocaleString('vi-VN')}</td></tr>)}</tbody></table>
          {transactions.length === 0 && <div className="p-10 text-center text-slate-400">Chưa có giao dịch kho.</div>}
        </div>
      </div>
    </div>
  </div>;
}
