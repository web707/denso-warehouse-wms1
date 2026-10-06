import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { calcPartCbm, fmtDec } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const empty = {
  orderId: '',
  partName: '',
  productCode: '',
  masterPo: '',
  dcPrefix: '',
  poNumber: '',
  divisionCode: '',
  quantity: '',
  weight: '',
  cartons: '',
  cartonLength: '',
  cartonWidth: '',
  cartonHeight: '',
  rackId: '__none__',
  lotNumber: '',
  uomCode: 'EA',
  unitCost: '',
  expirationDate: '',
  supplierName: '',
  supplierId: '',
  supplierSiteCode: '',
};

const UOM_OPTIONS = [
  { value: 'EA', label: 'EA — cái' },
  { value: 'KG', label: 'KG — ki-lô-gam' },
  { value: 'ROLL', label: 'ROLL — cuộn' },
];

export default function PartDialog({ open, onOpenChange, part, defaultOrderId }) {
  const { orders, racks, addPart, updatePart, assignPart } = useStore();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (part) {
      setForm({
        ...empty,
        ...part,
        rackId: part.rackId || '__none__',
        quantity: String(part.quantity ?? ''),
        weight: String(part.weight ?? ''),
        cartons: String(part.cartons ?? ''),
        cartonLength: String(part.cartonLength ?? ''),
        cartonWidth: String(part.cartonWidth ?? ''),
        cartonHeight: String(part.cartonHeight ?? ''),
        unitCost: String(part.unitCost ?? ''),
        supplierId: String(part.supplierId ?? ''),
      });
    } else {
      setForm({ ...empty, orderId: defaultOrderId || orders[0]?.id || '' });
    }
  }, [part, open, orders, defaultOrderId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const cbmPreview =
    form.cartonLength && form.cartonWidth && form.cartonHeight && form.cartons
      ? calcPartCbm({
          cartonLength: +form.cartonLength,
          cartonWidth: +form.cartonWidth,
          cartonHeight: +form.cartonHeight,
          cartons: +form.cartons,
        })
      : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      orderId: form.orderId,
      partName: form.partName,
      productCode: form.productCode,
      masterPo: form.masterPo,
      dcPrefix: form.dcPrefix,
      poNumber: form.poNumber,
      divisionCode: form.divisionCode,
      quantity: +form.quantity || 0,
      weight: +form.weight || 0,
      cartons: +form.cartons || 0,
      cartonLength: +form.cartonLength || 0,
      cartonWidth: +form.cartonWidth || 0,
      cartonHeight: +form.cartonHeight || 0,
      rackId: form.rackId === '__none__' ? null : form.rackId,
      lotNumber: form.lotNumber.trim(),
      uomCode: form.uomCode || 'EA',
      unitCost: form.unitCost,
      expirationDate: form.expirationDate,
      supplierName: form.supplierName.trim(),
      supplierId: form.supplierId,
      supplierSiteCode: form.supplierSiteCode.trim(),
    };
    if (part) {
      await updatePart(part.id, data);
      if ((part.rackId || null) !== data.rackId) await assignPart(part.id, data.rackId);
    } else {
      const created = await addPart(data);
      if (data.rackId && created?.id) await assignPart(created.id, data.rackId);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{part ? 'Sửa thông tin hàng' : 'Thêm hàng (PART)'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Đơn hàng</Label>
              <Select value={form.orderId} onValueChange={(v) => set('orderId', v)}>
                <SelectTrigger><SelectValue placeholder="Chọn đơn hàng" /></SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.orderNumber} — {o.division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tên PART</Label>
              <Input value={form.partName} onChange={(e) => set('partName', e.target.value)} placeholder="PART 1" required />
            </div>
            <div className="space-y-1.5">
              <Label>Mã hàng (ItemNumber)</Label>
              <Input value={form.productCode} onChange={(e) => set('productCode', e.target.value)} placeholder="A009" />
            </div>
            <div className="space-y-1.5">
              <Label>Master PO</Label>
              <Input value={form.masterPo} onChange={(e) => set('masterPo', e.target.value)} placeholder="M91846" />
            </div>
            <div className="space-y-1.5">
              <Label>DC Prefix</Label>
              <Input value={form.dcPrefix} onChange={(e) => set('dcPrefix', e.target.value)} placeholder="10" />
            </div>
            <div className="space-y-1.5">
              <Label>Số PO</Label>
              <Input value={form.poNumber} onChange={(e) => set('poNumber', e.target.value)} placeholder="134736" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Kích thước & Số lượng</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Số lượng (PCS)</Label>
                <Input type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Trọng lượng (KG)</Label>
                <Input type="number" step="0.1" min="0" value={form.weight} onChange={(e) => set('weight', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Tổng thùng</Label>
                <Input type="number" min="0" value={form.cartons} onChange={(e) => set('cartons', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Dài (cm)</Label>
                <Input type="number" min="0" value={form.cartonLength} onChange={(e) => set('cartonLength', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Rộng (cm)</Label>
                <Input type="number" min="0" value={form.cartonWidth} onChange={(e) => set('cartonWidth', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Cao (cm)</Label>
                <Input type="number" min="0" value={form.cartonHeight} onChange={(e) => set('cartonHeight', e.target.value)} required />
              </div>
            </div>
            {cbmPreview > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium">
                CBM tự tính: {fmtDec(cbmPreview, 3)} m³
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Thông tin tồn kho (theo Oracle)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lotNumber">Số lô (LotNumber)</Label>
                <Input id="lotNumber" value={form.lotNumber} onChange={(e) => set('lotNumber', e.target.value)} placeholder="LOT-2026-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Đơn vị (UOMCode)</Label>
                <Select value={form.uomCode} onValueChange={(v) => set('uomCode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitCost">Đơn giá (UnitCost)</Label>
                <Input id="unitCost" type="number" step="0.01" min="0" value={form.unitCost} onChange={(e) => set('unitCost', e.target.value)} placeholder="12.50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expirationDate">Hạn dùng (ExpirationDate)</Label>
                <Input id="expirationDate" type="date" value={form.expirationDate} onChange={(e) => set('expirationDate', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplierName">Nhà cung cấp (SupplierName)</Label>
                <Input id="supplierName" value={form.supplierName} onChange={(e) => set('supplierName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplierId">Mã NCC (SupplierId)</Label>
                <Input id="supplierId" type="number" min="0" step="1" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor="supplierSiteCode">Site NCC (SupplierSiteCode)</Label>
                <Input id="supplierSiteCode" value={form.supplierSiteCode} onChange={(e) => set('supplierSiteCode', e.target.value)} placeholder="HN-01" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-1.5">
            <Label>Phân bổ vào Kệ kho</Label>
            <Select value={form.rackId} onValueChange={(v) => set('rackId', v)}>
              <SelectTrigger><SelectValue placeholder="Chưa phân bổ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Chưa phân bổ —</SelectItem>
                {racks.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit">{part ? 'Lưu thay đổi' : 'Thêm hàng'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}