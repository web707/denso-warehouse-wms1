import { cn } from '@/lib/utils';

const TONES = {
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  red: 'bg-red-100 text-red-700 border-red-200',
};

/** Nhãn trạng thái nhỏ. Màu dark mode đã được xử lý trong index.css. */
export default function Pill({ tone = 'slate', children, className, title }) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone] || TONES.slate, className)}
    >
      {children}
    </span>
  );
}
