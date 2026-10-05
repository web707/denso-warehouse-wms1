import { cn } from '@/lib/utils';

export default function RackLevelView({ level, slots, partsById, selectedSlotCode, onSelectSlot }) {
  const levelSlots = slots.filter((s) => s.level === level);
  return (
    <div className="border rounded-xl bg-white p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700">Tầng {level}</p>
        <p className="text-xs text-slate-400">{levelSlots.filter((s) => s.placements.length).length}/5 ô đang dùng</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {levelSlots.map((slot) => {
          const partId = slot.placements[0]?.partId;
          const part = partId ? partsById[partId] : null;
          return (
            <button
              key={slot.code}
              type="button"
              onClick={() => onSelectSlot(slot.code)}
              className={cn(
                'min-h-[92px] rounded-lg border p-2 text-left transition hover:shadow-sm',
                selectedSlotCode === slot.code ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200',
                slot.placements.length ? 'bg-slate-50' : 'bg-white',
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-700">{slot.code}</span>
                <span className="text-[10px] text-slate-400">K{slot.bay}</span>
              </div>
              {part ? (
                <div className="mt-2">
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: part.color }} />
                  <span className="text-[11px] font-semibold text-slate-700 line-clamp-2">{part.partName}</span>
                  <p className="text-[10px] text-slate-400 mt-1">{slot.placements.length} thùng</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-300 mt-4 text-center">Trống</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
