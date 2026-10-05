import { cn } from '@/lib/utils';
import { utilColor } from '@/lib/calculations';

export default function UtilizationBar({ percent, label, sublabel, className }) {
  const color = utilColor(percent);
  const clamped = Math.min(percent, 100);
  const overflow = percent > 100;

  return (
    <div className={cn('space-y-1', className)}>
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">{label}</span>
          <span className={cn('font-semibold tabular-nums', color.text)}>
            {percent.toFixed(1)}%
            {overflow && <span className="ml-1 text-red-500">⚠ Vượt</span>}
          </span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color.bg)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {sublabel && <p className="text-[11px] text-slate-400">{sublabel}</p>}
    </div>
  );
}