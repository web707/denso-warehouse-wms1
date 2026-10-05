import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { useStore } from '@/lib/store';
import { fmtDec, fmtNum } from '@/lib/calculations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, X, PackageCheck, ArrowRight, Warehouse } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function partCbm(p) {
  return (p.cartonLengthMm * p.cartonWidthMm * p.cartonHeightMm * p.cartonCount) / 1_000_000_000;
}

export default function ImportDialog({ open, onOpenChange, targetOrderId, targetOrderLabel, targetRackId, targetRackLabel, onImported }) {
  const navigate = useNavigate();
  const { resetData } = useStore();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [importedOrderId, setImportedOrderId] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setPreview(null);
    setLoading(true);
    try {
      const result = await api.imports.upload(f, true, targetOrderId, targetRackId);
      if (!result.orders || result.orders.length === 0) {
        throw new Error(result.errors?.[0]?.message || 'Không tìm thấy dữ liệu đơn hàng trong file');
      }
      setPreview(result);
    } catch (err) {
      setError(err.message || 'Không thể đọc file. Vui lòng kiểm tra định dạng.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setCommitting(true);
    try {
      const result = await api.imports.upload(file, false, targetOrderId, targetRackId);
      await resetData();
      // Capture the first created order for navigation
      const orderId = result.createdOrderIds?.[0] || targetOrderId || null;
      setImportedOrderId(orderId);
      toast({
        title: 'Nhập thành công',
        description:
          `Đã nhập ${result.orderCount} đơn hàng, ${result.insertedPartCount ?? result.partCount} PART` +
          (result.duplicatePartsSkipped > 0
            ? ` (bỏ qua ${result.duplicatePartsSkipped} PART trùng đã có sẵn)`
            : ''),
      });
      onImported?.(orderId, result);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Nhập thất bại', description: err.message });
    } finally {
      setCommitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setLoading(false);
    setCommitting(false);
    setImportedOrderId(null);
    onOpenChange(false);
  };

  const orders = preview?.orders || [];
  const errors = preview?.errors || [];
  const totalCbm = orders.reduce(
    (s, o) => s + (o.parts || []).reduce((ps, p) => ps + partCbm(p), 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{targetRackId ? `Nhập hàng vào ${targetRackLabel || 'kệ'}` : targetOrderId ? 'Nhập hàng từ file' : 'Nhập đơn hàng từ file'}</DialogTitle>
        </DialogHeader>

        {targetRackId ? (
          <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2 -mt-2">
            Toàn bộ PART mới trong file sẽ được thêm vào lô <strong>{targetOrderLabel || '—'}</strong> và gán trực tiếp vào <strong>{targetRackLabel || 'kệ đang mở'}</strong>.
            Sau khi nhập, hệ thống sẽ tối ưu vị trí S01–S20 theo giới hạn tải trọng.
          </div>
        ) : targetOrderId ? (
          <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2 -mt-2">
            Toàn bộ PART đọc được sẽ được thêm vào đơn hàng <strong>{targetOrderLabel || '—'}</strong>,
            bất kể số đơn hàng ghi trong file.
          </div>
        ) : null}

        <div className="space-y-4">
          {/* ── Success state after commit ── */}
          {importedOrderId && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <PackageCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-800">Nhập dữ liệu thành công!</p>
                </div>
              </div>
              <div className="flex gap-2">
                {targetRackId ? (
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={() => { handleClose(); navigate(`/racks/${targetRackId}/plan`); }}
                  >
                    <Warehouse className="w-4 h-4" />
                    Xem {targetRackLabel || 'kệ'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <>
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={() => { handleClose(); navigate(`/racks/${importedOrderId}`); }}
                    >
                      <Warehouse className="w-4 h-4" />
                      Phân bổ kệ kho
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" onClick={() => { handleClose(); navigate(`/orders/${importedOrderId}`); }}>
                      Xem đơn hàng
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {!importedOrderId && (
            <>
              {!file && (
                <div
                  onClick={() => inputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition"
                >
                  <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600">Kéo thả hoặc click để chọn file</p>
                  <p className="text-xs text-slate-400 mt-1">Hỗ trợ: Excel (.xlsx)</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleFile}
                    className="hidden"
                  />
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                  <p className="text-sm text-slate-500">Đang đọc và phân tích file...</p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700">Lỗi đọc file</p>
                    <p className="text-xs text-red-500 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {errors.length > 0 && (
                <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-700">
                      {errors.length} dòng bị bỏ qua do lỗi dữ liệu
                    </p>
                    <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                      {errors.map((e, i) => (
                        <li key={i} className="text-xs text-amber-600">
                          Dòng {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {orders.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-700">
                      Đọc thành công: {preview.orderCount} đơn hàng, {preview.partCount} PART
                    </p>
                    <span className="ml-auto text-xs text-slate-500">{fmtDec(totalCbm, 2)} m³</span>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    {orders.map((o, i) => (
                      <div key={i} className="border-b border-slate-100 last:border-0">
                        <div className="px-3 py-2 bg-slate-50 flex items-center gap-2">
                          <span className="font-semibold text-slate-700 text-sm">{o.orderNumber}</span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-500">{o.division}</span>
                          <span className="ml-auto text-xs text-slate-400">{o.parts?.length || 0} PART</span>
                        </div>
                        <table className="w-full text-xs">
                          <tbody>
                            {(o.parts || []).map((p, j) => (
                              <tr key={j} className="border-b border-slate-50">
                                <td className="px-3 py-1.5 font-medium text-slate-600">{p.partName}</td>
                                <td className="px-3 py-1.5 text-slate-500">{p.productCode}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{fmtNum(p.quantityPcs || 0)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{p.cartonCount} thùng</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{fmtNum(p.totalWeightKg || 0)} kg</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            {file && !loading && !importedOrderId && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mr-auto">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button
                  onClick={() => { setFile(null); setPreview(null); setError(null); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {!importedOrderId && <Button variant="outline" onClick={handleClose}>Hủy</Button>}
            {importedOrderId && <Button variant="outline" onClick={handleClose} className="ml-auto">Đóng</Button>}
            {orders.length > 0 && !importedOrderId && (
              <Button onClick={handleImport} disabled={committing} className="ml-auto">
                {committing ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1.5" />
                )}
                Nhập {preview.partCount} PART
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
