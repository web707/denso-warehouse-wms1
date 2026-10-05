// ARGB hex fills for ExcelJS — mirrors
// logifrontend/src/lib/viz/divisionColors.js exactly (HomeGoods pink, TJ
// Maxx red, Marshalls blue, Sierra yellow) so the exported sheet's colors
// match the on-screen 3D/top-view exactly.
const DIVISION_FILLS: Record<string, string> = {
  HG: 'FFF9A8D4',
  TJM: 'FFF87171',
  MAR: 'FF7DD3FC',
  SIERRA: 'FFFCD34D',
};

const FALLBACK_FILLS = ['FFC4B5FD', 'FF86EFAC', 'FFFDBA74', 'FFA5B4FC'];

export function divisionFillArgb(code?: string | null): string {
  if (!code) return 'FF94A3B8';
  const known = DIVISION_FILLS[code.toUpperCase()];
  if (known) return known;
  let hash = 0;
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) % FALLBACK_FILLS.length;
  return FALLBACK_FILLS[hash];
}
