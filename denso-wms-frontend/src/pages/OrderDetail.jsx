import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { calcPartCbm, fmtDec, fmtNum, fmtKg } from '@/lib/calculations';
import PartDialog from '@/components/PartDialog';
import ImportDialog from '@/components/ImportDialog';
import RackAllocationWizard from '@/components/RackAllocationWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ExpiryBadge from '@/components/ExpiryBadge';
import Pill from '@/components/Pill';
import { JUDGMENT, lotStatusMap, useLotStatus } from '@/lib/supplyChain';
import { ArrowLeft, Pencil, Trash2, MoreVertical, PackagePlus, Search, Upload, ArrowRight } from 'lucide-react';

// A dedicated page per order (not a same-page reveal) — every action here
// (Nhập file, Thêm hàng) is scoped to THIS order's id from the route, so
// there's no way to accidentally act on a different order.
export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { orders, parts, racks, deletePart, assignPart, deleteOrder } = useStore();
  const { data: lotStatus = [] } = useLotStatus();
  const lotQuality = lotStatusMap(lotStatus);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState('');

  const order = orders.find((o) => o.id === orderId);

  const orderRacks = useMemo(() => racks.filter((c) => c.orderId === orderId), [racks, orderId]);
  const orderParts = useMemo(() => parts.filter((p) => p.orderId === orderId), [parts, orderId]);
  const filtered = useMemo(() => {
    if (!search) return orderParts;
    const q = search.toLowerCase();
    return orderParts.filter(
      (p) =>
        p.partName?.toLowerCase().includes(q) ||
        p.productCode?.toLowerCase().includes(q) ||
        p.lotNumber?.toLowerCase().includes(q) ||
        p.supplierName?.toLowerCase().includes(q) ||
        p.masterPo?.toLowerCase().includes(q),
    );
  }, [orderParts, search]);

  const totalCbm = orderParts.reduce((s, p) => s + calcPartCbm(p), 0);
  const totalWeight = orderParts.reduce((s, p) => s + (p.weight || 0), 0);
  const totalCartons = orderParts.reduce((s, p) => s + (p.cartons || 0), 0);

  const handleEdit = (part) => { setEditing(part); setDialogOpen(true); };
  const handleAdd = () => { setEditing(null); setDialogOpen(true); };

  const handleDeleteOrder = async () => {
    await deleteOrder(orderId);
    navigate('/orders');
  };

  // No rack yet for this order → open the wizard straight to the
  // "pick a rack type" step (it already knows the order, via
  // presetOrderId, so there's nothing to choose there). Once at least one
  // rack exists, jump straight to viewing it instead.
  const handleDongHang = () => {
    if (orderRacks.length === 0) {
      setWizardOpen(true);
    } else {
      navigate(`/racks/${orderId}`);
    }
  };

  if (!order) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Tất cả đơn hàng
        </Button>
        <p className="text-sm text-slate-400">Không tìm thấy đơn hàng này.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate('/orders')} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Tất cả đơn hàng
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">{order.name || order.orderNumber}</h1>
            <Badge variant="secondary" className="text-xs">{order.orderNumber}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {order.division} → {order.destination} · {orderParts.length} PART · {fmtNum(totalCartons)} thùng ·{' '}
            {fmtDec(totalCbm, 2)} m³ · {fmtNum(totalWeight)} kg
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Nhập file
          </Button>
          <Button variant="outline" onClick={handleAdd}>
            <PackagePlus className="w-4 h-4 mr-1.5" /> Thêm hàng
          </Button>
          <Button variant="outline" onClick={handleDongHang}>
            Phân hàng <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-red-600" onClick={handleDeleteOrder}>
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa đơn hàng
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Tìm PART, mã hàng, Master PO..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">PART</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Item Number</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Lot Number</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Division</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">DC Prefix</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Master PO</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right whitespace-nowrap">Số lượng</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Hạn dùng</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right whitespace-nowrap">Trọng lượng</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right whitespace-nowrap">Thùng</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Kích thước (cm)</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-right whitespace-nowrap">CBM</th>
                <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Kệ kho</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-400">Không có hàng hóa nào.</td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                      <span className="font-medium text-slate-700">{p.partName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.productCode}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                    {p.lotNumber || '—'}
                    {p.lotNumber && lotQuality.get(p.lotNumber) && (
                      <Pill tone={JUDGMENT[lotQuality.get(p.lotNumber).judgment].tone} className="ml-2" title={`Kiểm tra ${lotQuality.get(p.lotNumber).inspectionType}`}>{lotQuality.get(p.lotNumber).judgment}</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs font-semibold">{p.divisionCode || '—'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">{p.dcPrefix || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">{p.masterPo || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtNum(p.quantity)} <span className="text-xs text-slate-400">{p.uomCode}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap"><ExpiryBadge date={p.expirationDate} /></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtKg(p.weight)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{p.cartons}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.cartonLength} × {p.cartonWidth} × {p.cartonHeight}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{fmtDec(calcPartCbm(p), 3)}</td>
                  <td className="px-4 py-3">
                    <Select value={p.rackId || '__none__'} onValueChange={(v) => assignPart(p.id, v === '__none__' ? null : v)}>
                      <SelectTrigger className="h-8 text-xs w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Chưa phân bổ —</SelectItem>
                        {orderRacks.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(p)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => deletePart(p.id)}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <PartDialog open={dialogOpen} onOpenChange={setDialogOpen} part={editing} defaultOrderId={orderId} />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        targetOrderId={orderId}
        targetOrderLabel={order.name || order.orderNumber}
      />

      <RackAllocationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        presetOrderId={orderId}
        onComplete={(id) => navigate(`/racks/${id}`)}
      />
    </div>
  );
}
