import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Boxes, Info, Warehouse } from 'lucide-react';
import PackingRuleEditor from '@/components/PackingRuleEditor';
import { RACK_SPEC } from '@/lib/viz/rackLayout';

const specRows = [
  { section: 'Cấu trúc kệ', rows: [
    { label: 'Số khoang', value: `${RACK_SPEC.bays}` },
    { label: 'Số tầng', value: `${RACK_SPEC.levels}` },
    { label: 'Tổng ô', value: `${RACK_SPEC.slotCount}` },
  ]},
  { section: 'Kích thước mỗi ô', rows: [
    { label: 'Rộng', value: `${RACK_SPEC.bayWidthMm.toLocaleString('vi-VN')} mm` },
    { label: 'Sâu', value: `${RACK_SPEC.depthMm.toLocaleString('vi-VN')} mm` },
    { label: 'Cao', value: `${RACK_SPEC.levelHeightMm.toLocaleString('vi-VN')} mm` },
  ]},
  { section: 'Quy ước vị trí', rows: [
    { label: 'Tầng 1', value: 'S01 – S05' },
    { label: 'Tầng 2', value: 'S06 – S10' },
    { label: 'Tầng 3', value: 'S11 – S15' },
    { label: 'Tầng 4', value: 'S16 – S20' },
  ]},
  { section: 'Nguyên tắc', rows: [
    { label: 'Phân tách', value: '1 PART / ô' },
    { label: 'Ưu tiên', value: 'Tầng thấp trước' },
    { label: 'Xoay thùng', value: '90° mặt đáy' },
  ]},
];

export default function PackingRules() {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Quy ước lưu kho</h1>
        <p className="text-sm text-slate-500 mt-1">Thông số kỹ thuật và nguyên tắc phân bổ linh kiện trên kệ kho</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-indigo-600" />
              <CardTitle>Kệ linh kiện tiêu chuẩn</CardTitle>
            </div>
            <Badge className="bg-indigo-600">5 × 4 = 20 ô</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-slate-200 rounded-lg overflow-hidden">
            {specRows.map((group) => (
              <div key={group.section} className="bg-white p-4 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{group.section}</p>
                {group.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">{r.label}</span>
                    <span className="font-semibold text-slate-900 tabular-nums text-right">{r.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Nguyên tắc phân hàng</CardTitle>
            <Badge variant="secondary" className="text-xs">Có thể chỉnh sửa</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 mb-4">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Hệ thống ưu tiên gom cùng PART vào cùng ô kệ, xếp từ tầng thấp lên tầng cao và tự chuyển sang ô tiếp theo khi ô hiện tại đầy.
            </p>
          </div>
          <PackingRuleEditor />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sơ đồ đánh số vị trí</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 20 }, (_, i) => {
              const level = Math.floor(i / 5) + 1;
              const bay = (i % 5) + 1;
              return (
                <div key={i} className="rounded-lg border bg-slate-50 p-3 text-center">
                  <Boxes className="w-4 h-4 mx-auto text-indigo-500 mb-1" />
                  <p className="text-xs font-bold text-slate-700">S{String(i + 1).padStart(2, '0')}</p>
                  <p className="text-[10px] text-slate-400">T{level} · K{bay}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
