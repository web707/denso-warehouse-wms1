import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import RackAllocationWizard from '@/components/RackAllocationWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Package } from 'lucide-react';

// Order picker only — each card navigates to its own page (/orders/:id)
// instead of revealing content on this same page, so there's never any
// ambiguity about which order an action (Nhập file, Thêm hàng) applies to.
export default function Orders() {
  const { orders, parts, addOrder } = useStore();
  const navigate = useNavigate();
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({ orderNumber: '', name: '', division: '', destination: 'DENSO-WH' });

  const handleAddOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.orderNumber) return;
    const order = await addOrder(newOrder);
    setNewOrder({ orderNumber: '', name: '', division: '', destination: 'DENSO-WH' });
    setAddOrderOpen(false);
    // Jump straight into the new (still empty) order's own page.
    navigate(`/orders/${order.id}`);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lô linh kiện & Vật tư</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý lô linh kiện, PART và vị trí lưu kho</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddOrderOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Lô linh kiện
          </Button>
          <Button onClick={() => setWizardOpen(true)}>
            <Package className="w-4 h-4 mr-1.5" /> Bắt đầu phân hàng mới
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-slate-400">
            Chưa có đơn hàng nào. Nhấn "Lô linh kiện" để tạo đơn hàng đầu tiên.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((o) => {
            const count = parts.filter((p) => p.orderId === o.id).length;
            return (
              <Card
                key={o.id}
                onClick={() => navigate(`/orders/${o.id}`)}
                className="p-5 cursor-pointer transition hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <Package className="w-5 h-5" />
                </div>
                <p className="font-bold text-slate-900 truncate">{o.name || o.orderNumber}</p>
                <p className="text-sm text-slate-400 mb-3">{count} PART có sẵn</p>
                <Button size="sm" variant="outline" className="w-full">Xem chi tiết</Button>
              </Card>
            );
          })}
        </div>
      )}

      <RackAllocationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={(orderId) => navigate(`/racks/${orderId}`)}
      />

      {/* Add order dialog */}
      <Dialog open={addOrderOpen} onOpenChange={setAddOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm lô linh kiện mới</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddOrder} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tên lô linh kiện</Label>
              <Input
                value={newOrder.name}
                onChange={(e) => setNewOrder({ ...newOrder, name: e.target.value })}
                placeholder="VD: Lô linh kiện tháng 8"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mã lô</Label>
              <Input value={newOrder.orderNumber} onChange={(e) => setNewOrder({ ...newOrder, orderNumber: e.target.value })} placeholder="KH187" required />
            </div>
            <div className="space-y-1.5">
              <Label>Điểm xuất (điểm nhập hàng)</Label>
              <Input
                value={newOrder.division}
                onChange={(e) => setNewOrder({ ...newOrder, division: e.target.value })}
                placeholder="VD: Kho TP.HCM"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kho đích</Label>
              <Input value={newOrder.destination} onChange={(e) => setNewOrder({ ...newOrder, destination: e.target.value })} placeholder="DENSO-WH" />
            </div>
            <p className="text-xs text-slate-400">
              Lô linh kiện sẽ được tạo trống — thêm hàng bằng tay ("Thêm hàng") hoặc nhập từ file ("Nhập file") ở trang của đơn hàng này.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOrderOpen(false)}>Hủy</Button>
              <Button type="submit">Thêm</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
