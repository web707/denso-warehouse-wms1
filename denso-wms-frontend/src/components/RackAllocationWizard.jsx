import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Loader2,
  PackagePlus,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import RackRecommendationBanner, {
  useRackRecommendation,
} from '@/components/RackRecommendation';

const STEPS = ['order', 'rack', 'allocating', 'done'];

export default function RackAllocationWizard({ open, onOpenChange, onComplete, presetOrderId }) {
  const { orders, racks, rackTypes, resetData, createRackForOrder, autoAssignRack } =
    useStore();
  const { toast } = useToast();

  const [step, setStep] = useState('order');
  const [orderMode, setOrderMode] = useState('existing');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [newOrderFile, setNewOrderFile] = useState(null);
  const [newOrderPreview, setNewOrderPreview] = useState(null);
  const [newOrderLoading, setNewOrderLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [rackForm, setRackForm] = useState({ name: '', rackTypeId: '', warehouseCode: 'DENSO-WH', zoneCode: 'ZONE-A' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [allocateResult, setAllocateResult] = useState(null);

  const activeOrder = orders.find((o) => o.id === activeOrderId);
  const orderRackCount = useMemo(
    () => racks.filter((c) => c.orderId === activeOrderId).length,
    [racks, activeOrderId],
  );

  // Re-fetched whenever a rack was just created/assigned (allocateResult
  // changes), since that changes which parts still need a rack.
  const { recommendation, loading: recLoading } = useRackRecommendation(
    activeOrderId,
    allocateResult,
  );

  useEffect(() => {
    if (step === 'rack' && recommendation?.recommendedRackTypeId) {
      setRackForm((f) => ({
        ...f,
        rackTypeId: f.rackTypeId || recommendation.recommendedRackTypeId,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, recommendation]);

  useEffect(() => {
    if (open) {
      // A known target order (e.g. "Phân hàng" from that order's own page)
      // skips the whole "which order" step — there's nothing to pick.
      setStep(presetOrderId ? 'rack' : 'order');
      setOrderMode('existing');
      setSelectedOrderId('');
      setNewOrderFile(null);
      setNewOrderPreview(null);
      setNewOrderLoading(false);
      setActiveOrderId(presetOrderId || null);
      setRackForm({ name: '', rackTypeId: '', warehouseCode: 'DENSO-WH', zoneCode: 'ZONE-A' });
      setError(null);
      setAllocateResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetOrderId]);

  useEffect(() => {
    if (step === 'rack') {
      setRackForm((f) => ({ ...f, name: f.name || `Kệ ${orderRackCount + 1}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, orderRackCount]);

  const handleClose = () => onOpenChange(false);

  const handleNewOrderFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setNewOrderFile(f);
    setNewOrderPreview(null);
    setError(null);
    setNewOrderLoading(true);
    try {
      const result = await api.imports.upload(f, true);
      if (!result.orders || result.orders.length === 0) {
        throw new Error(result.errors?.[0]?.message || 'Không tìm thấy dữ liệu đơn hàng trong file');
      }
      setNewOrderPreview(result);
    } catch (err) {
      setError(err.message || 'Không thể đọc file. Vui lòng kiểm tra định dạng.');
      setNewOrderFile(null);
    } finally {
      setNewOrderLoading(false);
    }
  };

  const handleOrderNext = async () => {
    setError(null);
    if (orderMode === 'existing') {
      if (!selectedOrderId) return setError('Vui lòng chọn một đơn hàng');
      setActiveOrderId(selectedOrderId);
      setStep('rack');
      return;
    }
    // orderMode === 'new': the file was already read+previewed by
    // handleNewOrderFile — committing it is what actually creates the order
    // AND its PART rows in one step (previously this tab only created a bare
    // order shell with no way to attach a file, so "creating a new order"
    // silently produced zero PART despite reporting success).
    if (!newOrderFile || !newOrderPreview) return setError('Vui lòng chọn file đơn hàng để nhập');
    setBusy(true);
    try {
      const result = await api.imports.upload(newOrderFile, false);
      const orderId = result.createdOrderIds?.[0];
      if (!orderId) throw new Error('Không thể tạo đơn hàng từ file');
      await resetData();
      setActiveOrderId(orderId);
      setStep('rack');
    } catch (err) {
      setError(err.message || 'Không thể nhập file');
    } finally {
      setBusy(false);
    }
  };

  const handleRackNext = async () => {
    setError(null);
    if (!rackForm.rackTypeId) return setError('Vui lòng chọn cấu hình kệ');
    if (!rackForm.name.trim()) return setError('Vui lòng đặt tên kệ');
    setBusy(true);
    try {
      const rack = await createRackForOrder(activeOrderId, rackForm);
      setStep('allocating');
      const result = await autoAssignRack(rack.id);
      setAllocateResult(result);
      setStep(result.remainingUnassignedCount > 0 ? 'rack' : 'done');
      setRackForm({ name: '', rackTypeId: '', warehouseCode: 'DENSO-WH', zoneCode: 'ZONE-A' });
    } catch (err) {
      setError(err.message || 'Không thể tạo kệ hoặc phân bổ');
      setStep('rack');
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = () => {
    onComplete?.(activeOrderId);
    toast({ title: 'Hoàn thành', description: `Đã phân bổ xong đơn hàng ${activeOrder?.name || ''}` });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Phân hàng cho đơn hàng mới</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  STEPS.indexOf(step) >= i ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-slate-200" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-2">
            {error}
          </div>
        )}

        {step === 'order' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={orderMode === 'existing' ? 'default' : 'outline'}
                onClick={() => setOrderMode('existing')}
                className="flex-1"
              >
                Chọn đơn hàng có sẵn
              </Button>
              <Button
                type="button"
                variant={orderMode === 'new' ? 'default' : 'outline'}
                onClick={() => setOrderMode('new')}
                className="flex-1"
              >
                Tạo đơn hàng mới
              </Button>
            </div>

            {orderMode === 'existing' ? (
              <div className="space-y-1.5">
                <Label>Đơn hàng</Label>
                <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn đơn hàng..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} · {o.orderNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                {!newOrderFile && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition"
                  >
                    <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">
                      Kéo thả hoặc click để chọn file đơn hàng
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Hỗ trợ: Excel (.xlsx)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      onChange={handleNewOrderFile}
                      className="hidden"
                    />
                  </div>
                )}
                {newOrderLoading && (
                  <div className="flex items-center justify-center py-6 gap-3">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    <p className="text-sm text-slate-500">Đang đọc file...</p>
                  </div>
                )}
                {newOrderPreview && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <p className="text-xs text-emerald-700">
                        Đọc thành công: {newOrderPreview.orderCount} đơn hàng, {newOrderPreview.partCount} PART
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="truncate flex-1">{newOrderFile?.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setNewOrderFile(null);
                          setNewOrderPreview(null);
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'rack' && (
          <div className="space-y-4">
            {allocateResult && allocateResult.remainingUnassignedCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700">
                  Kệ trước đã đầy — còn {allocateResult.remainingUnassignedCount} PART chưa xếp.
                  Thêm một kệ mới để tiếp tục.
                </p>
              </div>
            )}
            <RackRecommendationBanner
              recommendation={recommendation}
              loading={recLoading}
              rackTypes={rackTypes}
            />
            <div className="space-y-1.5">
              <Label>Tên kệ</Label>
              <Input
                value={rackForm.name}
                onChange={(e) => setRackForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kho</Label>
                <Input value={rackForm.warehouseCode} onChange={(e) => setRackForm((f) => ({ ...f, warehouseCode: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Khu vực</Label>
                <Select value={rackForm.zoneCode} onValueChange={(v) => setRackForm((f) => ({ ...f, zoneCode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZONE-A">ZONE-A</SelectItem>
                    <SelectItem value="ZONE-B">ZONE-B</SelectItem>
                    <SelectItem value="ZONE-C">ZONE-C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cấu hình sức chứa</Label>
              <Select
                value={rackForm.rackTypeId}
                onValueChange={(v) => setRackForm((f) => ({ ...f, rackTypeId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn cấu hình..." />
                </SelectTrigger>
                <SelectContent>
                  {rackTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 'allocating' && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm text-slate-500">Đang phân bổ hàng lên kệ...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700">
                Đã phân bổ xong toàn bộ hàng hoá của đơn "{activeOrder?.name}"
              </p>
            </div>
            {allocateResult?.violations?.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="text-xs text-amber-700 space-y-0.5">
                  <p className="font-medium">{allocateResult.violations.length} cảnh báo xếp hàng:</p>
                  {allocateResult.violations.slice(0, 5).map((v, i) => (
                    <p key={i}>{v.message}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Boxes className="w-4 h-4" />
              {orderRackCount} kệ cho đơn hàng này
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Hủy</Button>
          {step === 'order' && (
            <Button onClick={handleOrderNext} disabled={busy || newOrderLoading}>
              {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {orderMode === 'new' ? 'Nhập & tiếp tục' : 'Tiếp tục'}
            </Button>
          )}
          {step === 'rack' && (
            <Button onClick={handleRackNext} disabled={busy}>
              {busy ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <PackagePlus className="w-4 h-4 mr-1.5" />
              )}
              Tạo & phân bổ
            </Button>
          )}
          {step === 'done' && <Button onClick={handleFinish}>Hoàn thành</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
