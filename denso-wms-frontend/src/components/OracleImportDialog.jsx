import { useState } from 'react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EXAMPLE = `{
  "ShipmentNumber": "SHP-2026-0100",
  "CustomerNumber": "C-TOY",
  "CustomerName": "Toyota",
  "RequestedShipDate": "2026-10-20T00:00:00Z",
  "ShipmentStatus": "Released",
  "CarrierCode": "DHL",
  "GrossWeight": 1250,
  "WeightUOMCode": "KG",
  "ShippedQuantity": 4950,
  "LotNumber": "LOT-2026-001",
  "ItemNumber": "A009",
  "SourceOrderNumber": "PO-TOY-5521"
}`;

/** Chấp nhận một object, một mảng, hoặc dạng Oracle { "items": [...] }. */
export function parseOraclePayload(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && typeof data === 'object') return [data];
  throw new Error('Nội dung phải là một object hoặc một mảng các lô giao');
}

export default function OracleImportDialog({ open, onOpenChange, onDone }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const reset = (o) => {
    if (!o) { setText(''); setError(''); setResult(null); }
    onOpenChange(o);
  };

  const run = async () => {
    setError('');
    setResult(null);
    let items;
    try {
      items = parseOraclePayload(text);
    } catch (e) {
      setError(e instanceof SyntaxError ? 'JSON không hợp lệ. Kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.' : e.message);
      return;
    }
    if (items.length === 0) { setError('Không có lô giao nào để nhập.'); return; }
    setBusy(true);
    const failed = [];
    let created = 0;
    for (const [i, item] of items.entries()) {
      try {
        await api.shipments.oracleCreate(item);
        created += 1;
      } catch (e) {
        failed.push(`${item?.ShipmentNumber || `Dòng ${i + 1}`}: ${e.message}`);
      }
    }
    setBusy(false);
    setResult({ created, failed });
    if (created > 0) onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập JSON theo chuẩn Oracle</DialogTitle>
          <DialogDescription>
            Dán một lô giao (hoặc nhiều lô trong một mảng). ShipmentId và DelayDays nếu có sẽ bị bỏ qua vì hệ thống tự sinh và tự tính.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          rows={12}
          spellCheck={false}
          aria-label="JSON lô giao theo chuẩn Oracle"
          className="font-mono text-xs"
        />
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {result && (
          <div role="status" className="rounded-md border border-slate-200 px-3 py-2 text-sm space-y-1">
            <p className="text-emerald-700">Đã tạo {result.created} lô giao.</p>
            {result.failed.length > 0 && (
              <>
                <p className="text-red-700">{result.failed.length} lô bị từ chối:</p>
                <ul className="list-disc pl-5 text-red-700">{result.failed.map((f) => <li key={f}>{f}</li>)}</ul>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setText(EXAMPLE)} type="button">Điền ví dụ</Button>
          <Button variant="outline" onClick={() => reset(false)} type="button">Đóng</Button>
          <Button onClick={run} disabled={busy || !text.trim()} type="button">{busy ? 'Đang nhập…' : 'Nhập'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
