import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, MapPinned, QrCode, Warehouse } from 'lucide-react';
import { useStore } from '@/lib/store';
import { calcPartCbm, fmtDec, fmtNum } from '@/lib/calculations';
import { RACK_STATUS_META, RACK_STATUS_ORDER, SLOTS_PER_RACK, expiryInfo, summarizeWarehouse } from '@/lib/warehouse';
import UtilizationBar from '@/components/UtilizationBar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const LEGEND = RACK_STATUS_ORDER.map((key) => ({ key, ...RACK_STATUS_META[key] }));

function KpiCell({ label, value, unit, sub, children, to, tone }) {
  const body = (
    <div className="p-5 h-full">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-semibold tabular-nums text-slate-900', tone === 'warn' && 'text-amber-600')}>
        {value}
        {unit && <span className="ml-1 text-base font-medium text-slate-500">{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      {children}
    </div>
  );
  return to ? (
    <Link to={to} className="block hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6" aria-busy="true">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function Dashboard() {
  const { orders, parts, racks, isLoading } = useStore();

  const wh = useMemo(() => summarizeWarehouse(racks, parts), [racks, parts]);

  const stats = useMemo(() => ({
    totalCbm: parts.reduce((s, p) => s + calcPartCbm(p), 0),
    totalWeight: parts.reduce((s, p) => s + (p.weight || 0), 0),
    totalCartons: parts.reduce((s, p) => s + (p.cartons || 0), 0),
    unallocatedCount: wh.unallocated.length,
    unallocatedCbm: wh.unallocated.reduce((s, p) => s + calcPartCbm(p), 0),
    totalSlots: wh.totalSlots,
    usedSlots: wh.usedSlots,
  }), [parts, wh]);

  const zones = wh.zones;

  const expiry = useMemo(() => {
    const expired = [];
    const soon = [];
    parts.forEach((p) => {
      const info = expiryInfo(p.expirationDate);
      if (info?.status === 'expired') expired.push(p);
      else if (info?.status === 'soon') soon.push(p);
    });
    return { expired, soon };
  }, [parts]);

  const alerts = useMemo(() => {
    const over = wh.racks.filter((r) => r.status === 'overload');
    const near = wh.racks.filter((r) => r.status === 'near' || r.status === 'full');
    const list = [];
    if (over.length) list.push({ tone: 'red', text: `${over.length} kệ quá tải`, hint: over.slice(0, 3).map((r) => r.rack.name).join(', '), to: `/racks/${over[0].rack.id}/plan` });
    if (near.length) list.push({ tone: 'amber', text: `${near.length} kệ gần đầy hoặc đầy`, hint: near.slice(0, 3).map((r) => r.rack.name).join(', '), to: `/racks/${near[0].rack.id}/plan` });
    if (expiry.expired.length) list.push({ tone: 'red', text: `${expiry.expired.length} PART đã hết hạn`, hint: expiry.expired.slice(0, 3).map((p) => p.partName).join(', '), to: `/orders/${expiry.expired[0].orderId}` });
    if (expiry.soon.length) list.push({ tone: 'amber', text: `${expiry.soon.length} PART sắp hết hạn (≤ 30 ngày)`, hint: expiry.soon.slice(0, 3).map((p) => p.partName).join(', '), to: `/orders/${expiry.soon[0].orderId}` });
    if (stats.unallocatedCount) list.push({ tone: 'amber', text: `${fmtNum(stats.unallocatedCount)} PART chưa xếp kệ`, hint: `${fmtDec(stats.unallocatedCbm, 2)} m³ đang chờ`, to: '/orders' });
    return list;
  }, [wh, stats, expiry]);

  const watchList = useMemo(
    () => wh.racks.filter((r) => r.partCount > 0).sort((a, b) => b.loadPct - a.loadPct).slice(0, 8),
    [wh],
  );

  if (isLoading) return <DashboardSkeleton />;

  const slotPct = stats.totalSlots ? (stats.usedSlots / stats.totalSlots) * 100 : 0;

  return (
    <div className="p-4 sm:p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tổng quan kho</h1>
          <p className="text-sm text-slate-500 mt-1">
            {fmtNum(orders.length)} lô linh kiện · {zones.length} Zone · {fmtNum(racks.length)} kệ
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="bg-white">
            <Link to="/qr-labels"><QrCode className="w-4 h-4 mr-2" />QR & Barcode</Link>
          </Button>
          <Button asChild>
            <Link to="/inventory"><ArrowRightLeft className="w-4 h-4 mr-2" />Nhập · Xuất</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white grid grid-cols-2 lg:grid-cols-4 divide-slate-200 divide-y lg:divide-y-0 lg:divide-x [&>*:nth-child(2n)]:border-l [&>*:nth-child(2n)]:border-slate-200 lg:[&>*:nth-child(2n)]:border-l-0 overflow-hidden">
        <KpiCell label="PART trong kho" value={fmtNum(parts.length)} sub={`${fmtNum(stats.totalCartons)} thùng`} />
        <KpiCell
          label="Chưa xếp kệ"
          value={fmtNum(stats.unallocatedCount)}
          sub={stats.unallocatedCount ? `${fmtDec(stats.unallocatedCbm, 2)} m³ chờ xếp` : 'Đã xếp hết'}
          tone={stats.unallocatedCount ? 'warn' : undefined}
          to={stats.unallocatedCount ? '/orders' : undefined}
        />
        <KpiCell label="Ô đang dùng" value={`${stats.usedSlots}`} unit={`/ ${stats.totalSlots}`} sub={`${Math.max(0, stats.totalSlots - stats.usedSlots)} ô còn trống`}>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(slotPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Mức sử dụng ô">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(slotPct, 100)}%` }} />
          </div>
        </KpiCell>
        <KpiCell label="Tổng khối lượng" value={fmtNum(stats.totalWeight)} unit="kg" sub={`${fmtDec(stats.totalCbm, 2)} m³`} />
      </div>

      <section aria-label="Cần xử lý">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Không có kệ quá tải và mọi PART đã có vị trí.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {alerts.map((a) => (
              <Link
                key={a.text}
                to={a.to}
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  a.tone === 'red' ? 'border-red-200 bg-red-50 hover:bg-red-100' : 'border-amber-200 bg-amber-50 hover:bg-amber-100',
                )}
              >
                <AlertTriangle className={cn('w-5 h-5 mt-0.5 shrink-0', a.tone === 'red' ? 'text-red-600' : 'text-amber-600')} />
                <div className="min-w-0">
                  <p className={cn('text-sm font-semibold', a.tone === 'red' ? 'text-red-700' : 'text-amber-700')}>{a.text}</p>
                  {a.hint && <p className="text-xs text-slate-600 truncate">{a.hint}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white" aria-label="Công suất theo kệ">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Công suất theo kệ</h2>
            <p className="text-xs text-slate-500 mt-0.5">Mỗi ô là một kệ, tô màu theo trạng thái (cùng quy tắc với trang Sơ đồ kho). Bấm vào kệ để xem sơ đồ.</p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span className={cn('w-3 h-3 rounded-sm', l.swatch)} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>
        </div>

        {zones.length === 0 ? (
          <div className="py-12 text-center">
            <Warehouse className="w-8 h-8 mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">Chưa có kệ nào</p>
            <p className="text-sm text-slate-500">Tạo Zone và kệ để bắt đầu xếp hàng.</p>
            <Button asChild className="mt-4"><Link to="/zones">Mở Quản lý Zone</Link></Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {zones.map((z) => (
              <div key={z.zoneCode} className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <Link to={`/racks?zone=${encodeURIComponent(z.zoneCode)}`} className="inline-flex items-center gap-2 font-semibold text-slate-900 hover:text-indigo-600 focus-visible:outline-none focus-visible:underline">
                    <MapPinned className="w-4 h-4 text-indigo-500" />
                    {z.zoneCode}
                  </Link>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {z.usedRacks}/{z.rackCount} kệ có hàng · {z.usedSlots}/{z.totalSlots} ô · {z.partCount} PART · {fmtNum(z.totalWeight)} kg
                  </p>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {z.racks.map((rs) => (
                    <Link
                      key={rs.rack.id}
                      to={`/racks/${rs.rack.id}/plan`}
                      title={`${rs.rack.name}: ${RACK_STATUS_META[rs.status].label} · ${rs.usedSlots}/${SLOTS_PER_RACK} ô · thể tích ${fmtDec(rs.cbmPct, 0)}% · tải ${fmtDec(rs.weightPct, 0)}%`}
                      aria-label={`${rs.rack.name}, ${RACK_STATUS_META[rs.status].label}, ${rs.usedSlots} trên ${SLOTS_PER_RACK} ô`}
                      className={cn(
                        'h-12 rounded-md flex flex-col items-center justify-center leading-tight transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                        RACK_STATUS_META[rs.status].cell,
                      )}
                    >
                      <span className="text-[11px] font-semibold truncate max-w-full px-1">{rs.rack.name}</span>
                      {rs.usedSlots > 0 && <span className="text-[10px] tabular-nums opacity-90">{rs.usedSlots}/{SLOTS_PER_RACK}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {watchList.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white" aria-label="Kệ cần theo dõi">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Kệ tải nặng nhất</h2>
              <p className="text-xs text-slate-500 mt-0.5">8 kệ có thể tích hoặc tải trọng cao nhất.</p>
            </div>
            <Link to="/zones" className="text-sm font-medium text-indigo-600 hover:underline">Quản lý Zone</Link>
          </div>
          <div className="divide-y divide-slate-200">
            {watchList.map(({ rack, ...st }) => (
              <Link
                key={rack.id}
                to={`/racks/${rack.id}/plan`}
                className="grid grid-cols-1 md:grid-cols-[200px_1fr_1fr] gap-3 md:gap-6 items-center px-5 py-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-sm text-slate-900">{rack.name}</p>
                  <p className="text-xs text-slate-500">{rack.zoneCode} · {st.partCount} PART</p>
                </div>
                <UtilizationBar percent={st.cbmPct} label="Thể tích" sublabel={`${fmtDec(st.totalCbm, 2)} / ${rack.maxCbm} m³`} />
                <UtilizationBar percent={st.weightPct} label="Tải trọng" sublabel={`${fmtNum(st.totalWeight)} / ${fmtNum(rack.maxWeight)} kg`} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
