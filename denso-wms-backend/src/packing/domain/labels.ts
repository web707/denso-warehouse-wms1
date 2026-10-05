export function fmtLayer(n: number): string {
  return `L${String(n).padStart(2, '0')}`;
}

export function fmtRow(n: number): string {
  return `R${String(n).padStart(2, '0')}`;
}

export function fmtColumn(n: number): string {
  return `C${String(n).padStart(2, '0')}`;
}

export function cartonRef(layer: number, row: number, column: number): string {
  return `${fmtLayer(layer)}${fmtRow(row)}${fmtColumn(column)}`;
}

// TJX-style PO label: "{DC Prefix}-{Master PO}" — mirrors
// logifrontend/src/lib/viz/projection.js::formatPoLabel exactly, so the
// Excel export reads identically to the on-screen top-view.
export function formatPoLabel(dcPrefix?: string | null, masterPo?: string | null): string {
  if (!dcPrefix || !masterPo) return '';
  const prefix = String(dcPrefix).trim().padStart(2, '0');
  const po = String(masterPo).trim().replace(/\D/g, '').padStart(6, '0');
  return `${prefix}-${po}`;
}
