import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FileSpreadsheet, Printer, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { fmtDec, fmtNum } from '@/lib/calculations';
import { RACK_STATUS_META, RACK_STATUS_ORDER, SLOTS_PER_RACK, subinventoryCode, summarizeWarehouse, zoneOf } from '@/lib/warehouse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExpiryBadge from '@/components/ExpiryBadge';
import { cn } from '@/lib/utils';

const RANGES = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
];

const TX_META = {
  inbound: { label: 'Nhập kho', color: '#10b981' },
  outbound: { label: 'Xuất kho', color: '#f59e0b' },
  transfer: { label: 'Điều chuyển', color: '#6366f1' },
};

const AXIS = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };
const GRID = 'hsl(var(--border))';
const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
};

const COLUMNS = [
  { key: 'zone', label: 'Zone' },
  { key: 'rack', label: 'Kệ' },
  { key: 'partName', label: 'PART' },
  { key: 'productCode', label: 'Item Number' },
  { key: 'lotNumber', label: 'Lot Number' },
  { key: 'subinventory', label: 'Subinventory' },
  { key: 'expirationDate', label: 'Hạn dùng' },
  { key: 'uomCode', label: 'UOM' },
  { key: 'quantity', label: 'On-hand', numeric: true },
  { key: 'cartons', label: 'Thùng', numeric: true },
  { key: 'weight', label: 'Kg', numeric: true },
];

const PAGE_SIZE = 50;

function csvEscape(v) { return `"${String(v ?? '').replaceAll('"', '""')}"`; }

// File CSV có thêm các cột Oracle không đủ chỗ hiển thị trên bảng
const CSV_COLUMNS = [
  ...COLUMNS,
  { key: 'unitCost', label: 'UnitCost' },
  { key: 'supplierName', label: 'SupplierName' },
  { key: 'supplierSiteCode', label: 'SupplierSiteCode' },
];

function downloadCsv(rows) {
  const head = CSV_COLUMNS.map((c) => (c.label === 'Kg' ? 'Khối lượng kg' : c.label));
  const body = rows.map((r) => CSV_COLUMNS.map((c) => csvEscape(r[c.key])).join(','));
  const blob = new Blob(['\ufeff' + [head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bao-cao-ton-kho-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function dayKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function ChartCard({ title, hint, label, children, className }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-5', className)}>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      <div className="mt-4 h-64" role="img" aria-label={label || title}>{children}</div>
    </section>
  );
}

function Empty({ text }) {
  return <div className="h-full flex items-center justify-center text-sm text-slate-500">{text}</div>;
}

function Kpi({ label, value, unit }) {
  return (
    <div className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value}{unit && <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}

export default function Reports() {
  const { parts, racks, orders } = useStore();
  const [zone, setZone] = useState('ALL');
  const [range, setRange] = useState(30);
  const [tx, setTx] = useState([]);
  const [txError, setTxError] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'zone', dir: 'asc' });
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    api.inventory.list({ limit: 500 })
      .then((res) => { setTx(Array.isArray(res) ? res : res?.items || []); setTxError(false); })
      .catch(() => setTxError(true));
  }, []);

  const wh = useMemo(() => summarizeWarehouse(racks, parts), [racks, parts]);
  const zoneCodes = useMemo(() => wh.zones.map((z) => z.zoneCode), [wh]);
  const rackById = useMemo(() => new Map(racks.map((r) => [r.id, r])), [racks]);

  const zoneRacks = useMemo(
    () => (zone === 'ALL' ? wh.racks : wh.racks.filter((r) => zoneOf(r.rack) === zone)),
    [wh, zone],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parts
      .map((p) => {
        const r = rackById.get(p.rackId);
        return {
          id: p.id,
          zone: r ? zoneOf(r) : 'Chưa xếp',
          rack: r?.name || '—',
          partName: p.partName,
          productCode: p.productCode || '',
          lotNumber: p.lotNumber || '',
          subinventory: r ? subinventoryCode(r, p.preferredRackSlot) : '—',
          expirationDate: p.expirationDate || '',
          uomCode: p.uomCode || 'EA',
          unitCost: p.unitCost === '' || p.unitCost === undefined ? '' : p.unitCost,
          supplierName: p.supplierName || '',
          supplierSiteCode: p.supplierSiteCode || '',
          quantity: p.quantity || 0,
          cartons: p.cartons || 0,
          weight: p.weight || 0,
          divisionCode: p.divisionCode || 'Khác',
        };
      })
      .filter((r) => (zone === 'ALL' || r.zone === zone)
        && (!q || `${r.partName} ${r.productCode} ${r.lotNumber} ${r.supplierName} ${r.rack} ${r.zone}`.toLowerCase().includes(q)));
  }, [parts, rackById, zone, search]);

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a[sort.key]; const y = b[sort.key];
      return (col?.numeric ? x - y : String(x).localeCompare(String(y), 'vi', { numeric: true })) * dir;
    });
  }, [rows, sort]);

  const totals = useMemo(() => ({
    weight: rows.reduce((s, r) => s + r.weight, 0),
    cartons: rows.reduce((s, r) => s + r.cartons, 0),
    usedRacks: zoneRacks.filter((r) => r.usedSlots > 0).length,
  }), [rows, zoneRacks]);

  const zoneChart = useMemo(
    () => wh.zones
      .filter((z) => zone === 'ALL' || z.zoneCode === zone)
      .map((z) => ({ name: z.zoneCode.replace('ZONE-', 'Zone '), used: z.usedSlots, free: Math.max(0, z.totalSlots - z.usedSlots) })),
    [wh, zone],
  );

  const statusChart = useMemo(
    () => RACK_STATUS_ORDER
      .map((key) => ({ key, name: RACK_STATUS_META[key].label, value: zoneRacks.filter((r) => r.status === key).length, color: RACK_STATUS_META[key].color }))
      .filter((d) => d.value > 0),
    [zoneRacks],
  );

  const divisionChart = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => map.set(r.divisionCode, (map.get(r.divisionCode) || 0) + r.weight));
    return [...map.entries()].map(([name, kg]) => ({ name, kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg).slice(0, 8);
  }, [rows]);

  const txInRange = useMemo(() => {
    const since = Date.now() - range * 86_400_000;
    return tx.filter((t) => {
      if (new Date(t.createdAt).getTime() < since) return false;
      if (zone === 'ALL') return true;
      const r = rackById.get(t.toRackId) || rackById.get(t.fromRackId);
      return r && zoneOf(r) === zone;
    });
  }, [tx, range, zone, rackById]);

  const txCounts = useMemo(
    () => Object.fromEntries(Object.keys(TX_META).map((k) => [k, txInRange.filter((t) => t.type === k).length])),
    [txInRange],
  );

  const txChart = useMemo(() => {
    const days = [];
    for (let i = range - 1; i >= 0; i -= 1) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push({ key: dayKey(d), name: `${d.getDate()}/${d.getMonth() + 1}`, inbound: 0, outbound: 0, transfer: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    txInRange.forEach((t) => { const d = byKey.get(dayKey(t.createdAt)); if (d && d[t.type] !== undefined) d[t.type] += 1; });
    return days;
  }, [txInRange, range]);

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  return (
    <div className="p-4 sm:p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Báo cáo kho</h1>
          <p className="text-sm text-slate-500 mt-1">Tồn kho, mức sử dụng kệ và hoạt động nhập · xuất · điều chuyển.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <select
            aria-label="Lọc theo Zone"
            className="h-10 border border-input rounded-md px-3 bg-white text-sm"
            value={zone}
            onChange={(e) => { setZone(e.target.value); setVisible(PAGE_SIZE); }}
          >
            <option value="ALL">Tất cả Zone</option>
            {zoneCodes.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <Button variant="outline" className="bg-white" onClick={() => downloadCsv(sortedRows)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />Xuất CSV
          </Button>
          <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />In báo cáo</Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white grid grid-cols-2 md:grid-cols-5 divide-slate-200 md:divide-x [&>*]:border-slate-200 [&>*:nth-child(2n)]:border-l md:[&>*:nth-child(2n)]:border-l-0 [&>*:nth-child(n+3)]:border-t md:[&>*:nth-child(n+3)]:border-t-0">
        <Kpi label="PART" value={fmtNum(rows.length)} />
        <Kpi label="Kệ đang dùng" value={`${totals.usedRacks}/${zoneRacks.length}`} />
        <Kpi label="Thùng" value={fmtNum(totals.cartons)} />
        <Kpi label="Khối lượng" value={fmtNum(totals.weight)} unit="kg" />
        <Kpi label="Lô linh kiện" value={fmtNum(orders.length)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="Hoạt động theo ngày"
          hint={`${fmtNum(txCounts.inbound)} nhập · ${fmtNum(txCounts.outbound)} xuất · ${fmtNum(txCounts.transfer)} điều chuyển trong ${range} ngày qua`}
          label={`Số giao dịch mỗi ngày trong ${range} ngày qua`}
          className="lg:col-span-2"
        >
          <div className="h-full flex flex-col">
            <div className="flex gap-1 mb-2 print:hidden self-end" role="group" aria-label="Khoảng thời gian">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRange(r.value)}
                  aria-pressed={range === r.value}
                  className={cn(
                    'h-7 px-3 rounded-md text-xs font-medium border transition-colors',
                    range === r.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {txError ? (
              <Empty text="Không tải được lịch sử giao dịch. Thử làm mới trang." />
            ) : txInRange.length === 0 ? (
              <Empty text="Chưa có giao dịch trong khoảng này." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={txChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {Object.entries(TX_META).map(([key, m]) => (
                    <Bar key={key} dataKey={key} name={m.label} stackId="tx" fill={m.color} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Ô đã dùng theo Zone" hint={`Mỗi kệ có ${SLOTS_PER_RACK} ô`} label="Số ô đã dùng và còn trống của từng Zone">
          {zoneChart.length === 0 ? <Empty text="Chưa có Zone nào." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="used" name="Đã dùng" stackId="s" fill="#6366f1" />
                <Bar dataKey="free" name="Còn trống" stackId="s" fill="#cbd5e1" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Trạng thái kệ" hint={`${zoneRacks.length} kệ${zone === 'ALL' ? ' trong toàn kho' : ` trong ${zone}`}`} label="Số kệ theo từng trạng thái">
          {statusChart.length === 0 ? <Empty text="Chưa có kệ nào." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
                  {statusChart.map((d) => <Cell key={d.key} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v} kệ`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Khối lượng theo Division" hint="Tối đa 8 Division nặng nhất" label="Khối lượng hàng theo từng Division" className="lg:col-span-2">
          {divisionChart.length === 0 ? <Empty text="Chưa có hàng." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={divisionChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={72} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v) => [`${fmtNum(v)} kg`, 'Khối lượng']} />
                <Bar dataKey="kg" name="Khối lượng" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Chi tiết tồn kho</h2>
            <p className="text-xs text-slate-500 mt-0.5">{fmtNum(sortedRows.length)} PART · bấm tiêu đề cột để sắp xếp</p>
          </div>
          <div className="relative w-full sm:w-72 print:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
              placeholder="Tìm PART, mã hàng, kệ..."
              aria-label="Tìm trong bảng tồn kho"
              className="pl-9"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('p-0 font-medium', c.numeric ? 'text-right' : 'text-left')}>
                      <button type="button" onClick={() => toggleSort(c.key)} className={cn('inline-flex items-center gap-1 w-full px-3 py-3 hover:text-slate-900 focus-visible:outline-none focus-visible:bg-slate-100', c.numeric && 'justify-end')}>
                        {c.label}
                        {active && (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.slice(0, visible).map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="px-3 py-2.5">{r.zone}</td>
                  <td className="px-3 py-2.5 font-medium">{r.rack}</td>
                  <td className="px-3 py-2.5">{r.partName}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.productCode}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.lotNumber || '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.subinventory}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap"><ExpiryBadge date={r.expirationDate} /></td>
                  <td className="px-3 py-2.5">{r.uomCode}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(r.quantity)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(r.cartons)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtDec(r.weight, 1)}</td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr><td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-slate-500">Không có PART nào khớp bộ lọc.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {sortedRows.length > visible && (
          <div className="p-3 border-t border-slate-200 text-center print:hidden">
            <Button variant="ghost" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              Hiện thêm ({fmtNum(sortedRows.length - visible)} dòng nữa)
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
