import { expiryInfo } from '@/lib/warehouse';
import { cn } from '@/lib/utils';

const STYLE = {
  expired: 'bg-red-100 text-red-700 border-red-200',
  soon: 'bg-amber-100 text-amber-700 border-amber-200',
  ok: 'text-slate-600 border-transparent',
};

export default function ExpiryBadge({ date }) {
  const info = expiryInfo(date);
  if (!info) return <span className="text-slate-400">—</span>;
  const [y, m, d] = String(date).slice(0, 10).split('-');
  const label = `${d}/${m}/${y}`;
  const hint = info.status === 'expired' ? `Đã hết hạn ${Math.abs(info.days)} ngày` : info.status === 'soon' ? `Còn ${info.days} ngày` : undefined;
  return (
    <span title={hint} className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums', STYLE[info.status])}>
      {label}{info.status === 'expired' ? ' · hết hạn' : info.status === 'soon' ? ` · còn ${info.days}n` : ''}
    </span>
  );
}
