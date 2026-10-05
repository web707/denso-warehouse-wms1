// Brand/Division colours used in the warehouse rack visualization
// reference diagram (HomeGoods pink, TJ Maxx red, Marshalls blue, plus a
// reserved slot for any further TJX banner such as Sierra/HomeSense).
const DIVISION_COLORS = {
  HG: '#f9a8d4', // HomeGoods — pink
  TJM: '#f87171', // TJ Maxx — red
  MAR: '#7dd3fc', // Marshalls — blue
  SIERRA: '#fcd34d', // Sierra — yellow/orange
};

const FALLBACK_DIVISION_COLORS = ['#c4b5fd', '#86efac', '#fdba74', '#a5b4fc'];

export function divisionColor(code) {
  if (!code) return '#94a3b8';
  const known = DIVISION_COLORS[code.toUpperCase()];
  if (known) return known;
  // Deterministic fallback for any division not in the fixed palette above.
  let hash = 0;
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) % FALLBACK_DIVISION_COLORS.length;
  return FALLBACK_DIVISION_COLORS[hash];
}
