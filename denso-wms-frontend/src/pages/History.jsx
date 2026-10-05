import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Boxes, Settings, Upload, Download, PlayCircle, Trash2, Plus, Pencil, ChevronDown, ChevronUp, Warehouse, ArrowRight, MoveRight } from 'lucide-react';

const EVENT_META = {
  order_created: { icon: Plus, color: 'text-emerald-600 bg-emerald-50', label: 'Tạo lô' },
  order_updated: { icon: Pencil, color: 'text-blue-600 bg-blue-50', label: 'Cập nhật lô' },
  order_deleted: { icon: Trash2, color: 'text-red-600 bg-red-50', label: 'Xóa lô' },
  part_added: { icon: Package, color: 'text-emerald-600 bg-emerald-50', label: 'Thêm PART' },
  part_updated: { icon: Pencil, color: 'text-blue-600 bg-blue-50', label: 'Cập nhật PART' },
  part_deleted: { icon: Trash2, color: 'text-red-600 bg-red-50', label: 'Xóa PART' },
  part_assigned: { icon: Boxes, color: 'text-indigo-600 bg-indigo-50', label: 'Phân vị trí' },
  container_created: { icon: Warehouse, color: 'text-indigo-600 bg-indigo-50', label: 'Thêm kệ' },
  container_updated: { icon: Settings, color: 'text-blue-600 bg-blue-50', label: 'Cập nhật kệ' },
  container_deleted: { icon: Warehouse, color: 'text-red-600 bg-red-50', label: 'Xóa kệ' },
  rule_added: { icon: Settings, color: 'text-slate-600 bg-slate-50', label: 'Thêm quy ước' },
  rule_updated: { icon: Settings, color: 'text-slate-600 bg-slate-50', label: 'Sửa quy ước' },
  rule_deleted: { icon: Trash2, color: 'text-red-600 bg-red-50', label: 'Xóa quy ước' },
  import: { icon: Upload, color: 'text-violet-600 bg-violet-50', label: 'Nhập file' },
  export: { icon: Download, color: 'text-cyan-600 bg-cyan-50', label: 'Xuất báo cáo' },
  solve: { icon: PlayCircle, color: 'text-indigo-600 bg-indigo-50', label: 'Tính vị trí' },
};

function normalizeDescription(text = '') {
  return text
    .replace(/container/gi, 'kệ')
    .replace(/Container/g, 'Kệ');
}

function groupPartsByRack(details) {
  if (Array.isArray(details?.parts)) {
    const groups = new Map();
    details.parts.forEach((p) => {
      const key = p.rackName || p.rackId || 'Kệ';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    return [...groups.entries()].map(([rackName, items]) => ({ rackName, items }));
  }
  if (Array.isArray(details?.partNames) && details.rackName) {
    return [{ rackName: details.rackName, items: details.partNames.map((partName) => ({ partName })) }];
  }
  return [];
}

function MovementPanel({ details }) {
  if (details?.action !== 'rack_move') return null;
  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700"><MoveRight className="w-3.5 h-3.5" /> Điều chuyển vị trí</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-white border px-2 py-1 font-medium text-slate-700">{details.fromRackName || 'Kệ'}{details.fromSlot ? ` · ${details.fromSlot}` : ''}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="rounded-md bg-white border px-2 py-1 font-medium text-indigo-700">{details.toRackName || 'Kệ'}{details.toSlot ? ` · ${details.toSlot}` : ''}</span>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">{details.partName}{details.productCode ? ` · ${details.productCode}` : ''}{details.cartonCount ? ` · ${details.cartonCount} thùng` : ''}{details.totalWeightKg ? ` · ${Number(details.totalWeightKg).toLocaleString('vi-VN')} kg` : ''}</div>
    </div>
  );
}

function DetailPanel({ details }) {
  const groups = groupPartsByRack(details);
  if (!groups.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {groups.map(({ rackName, items }) => (
        <div key={rackName} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
          <p className="text-xs font-semibold text-slate-600 mb-1">{rackName} · {items.length} PART</p>
          <div className="flex flex-wrap gap-1.5">
            {items.map((p, i) => (
              <Badge key={`${p.partId || p.partName}-${i}`} variant="outline" className="text-[10px] bg-white">
                {p.partName || p.partId}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryRow({ h }) {
  const [open, setOpen] = useState(false);
  const meta = h.details?.action === 'rack_move'
    ? { icon: MoveRight, color: 'text-indigo-600 bg-indigo-50', label: 'Điều chuyển' }
    : EVENT_META[h.type] || { icon: Settings, color: 'text-slate-500 bg-slate-50', label: h.type };
  const Icon = meta.icon;
  const detail = groupPartsByRack(h.details);
  const expandable = detail.length > 0;

  return (
    <Card>
      <CardContent className="py-3.5 flex gap-3 items-start">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}><Icon className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary" className="text-[10px]">{meta.label}</Badge>
            <span className="text-[11px] text-slate-400">{new Date(h.timestamp || h.createdAt).toLocaleString('vi-VN')}</span>
          </div>
          <p className="text-sm text-slate-700 mt-1">{normalizeDescription(h.description)}</p>
          <MovementPanel details={h.details} />
          {open && <DetailPanel details={h.details} />}
        </div>
        {expandable && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function History() {
  const { history } = useStore();
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lịch sử kho</h1>
        <p className="text-sm text-slate-500 mt-1">Theo dõi nhập dữ liệu, phân kệ, thay đổi vị trí và xuất báo cáo</p>
      </div>
      {history.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-slate-400">Chưa có hoạt động nào.</CardContent></Card>
      ) : (
        <div className="space-y-2">{history.map((h) => <HistoryRow key={h.id} h={h} />)}</div>
      )}
    </div>
  );
}
