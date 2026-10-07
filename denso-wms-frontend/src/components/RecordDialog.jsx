import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Hộp thoại thêm/sửa dùng chung cho Lệnh sản xuất, Phiếu kiểm tra, Lô giao hàng.
 * fields: [{ type: 'section', label } | { key, label, type: text|number|date|datetime-local|select|switch,
 *            options, required, placeholder, step, span: 1|2|3, help }]
 * onSubmit(values) có thể ném lỗi; thông báo lỗi hiển thị ngay trong hộp thoại.
 */
export default function RecordDialog({ open, onOpenChange, title, description, fields, initial, onSubmit, submitLabel = 'Lưu', footerNote }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setValues(initial);
      setError('');
    }
  }, [open, initial]);

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Không lưu được. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {fields.map((f, i) => {
              if (f.type === 'section') {
                return (
                  <p key={`s${i}`} className="sm:col-span-3 text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2 border-t border-slate-100 first:border-0 first:pt-0">
                    {f.label}
                  </p>
                );
              }
              const id = `rec-${f.key}`;
              const span = f.span === 3 ? 'sm:col-span-3' : f.span === 2 ? 'sm:col-span-2' : '';
              return (
                <div key={f.key} className={`space-y-1.5 ${span}`}>
                  {f.type === 'switch' ? (
                    <label htmlFor={id} className="flex items-center justify-between gap-3 h-10 rounded-md border border-input px-3 text-sm">
                      <span>{f.label}</span>
                      <Switch id={id} checked={!!values[f.key]} onCheckedChange={(v) => set(f.key, v)} />
                    </label>
                  ) : (
                    <>
                      <Label htmlFor={id}>{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
                      {f.type === 'select' ? (
                        <Select value={values[f.key] ?? ''} onValueChange={(v) => set(f.key, v)}>
                          <SelectTrigger id={id}><SelectValue placeholder={f.placeholder || 'Chọn'} /></SelectTrigger>
                          <SelectContent>
                            {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={id}
                          type={f.type || 'text'}
                          step={f.type === 'number' ? f.step ?? 'any' : undefined}
                          min={f.type === 'number' ? f.min ?? 0 : undefined}
                          value={values[f.key] ?? ''}
                          onChange={(e) => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          required={f.required}
                        />
                      )}
                      {f.help && <p className="text-xs text-slate-500">{f.help}</p>}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {typeof footerNote === 'function' ? footerNote(values) : footerNote}
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
